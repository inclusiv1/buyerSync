import axios from 'axios';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parsePropertyText, parseUrlFallback, type PropertyData, scrapeProperty } from './scraper';

export type ImportAttempt = {
  provider: string;
  status: 'success' | 'incomplete' | 'failed' | 'skipped';
  message?: string;
};

export type ListingImportResult = PropertyData & {
  importMeta: {
    canonicalUrl: string;
    provider: string;
    completeness: number;
    warnings: string[];
    attempts: ImportAttempt[];
    cached: boolean;
  };
};

export interface ListingImportProvider {
  name: string;
  enabled: () => boolean;
  extract: (url: string, current: PropertyData) => Promise<PropertyData>;
}

const DEFAULT_ALLOWED_HOSTS = ['zillow.com', 'realtor.com', 'redfin.com'];
const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'ref', 'source']);
const CACHE_TTL_MS = 15 * 60 * 1000;
const COMPLETE_ENOUGH = 75;
const cache = new Map<string, { expiresAt: number; result: ListingImportResult }>();

function allowedHosts(): string[] {
  return [...DEFAULT_ALLOWED_HOSTS, ...(process.env.LISTING_IMPORT_ALLOWED_HOSTS || '').split(',')]
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedHost(hostname: string): boolean {
  return allowedHosts().some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address === '0.0.0.0') return true;
  if (address.startsWith('10.') || address.startsWith('127.') || address.startsWith('169.254.') || address.startsWith('192.168.')) return true;
  const secondOctet = Number(address.split('.')[1]);
  if (address.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31) return true;
  const normalized = address.toLowerCase();
  return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

export function canonicalizeListingUrl(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('A listing URL is required');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:') throw new Error('Only HTTPS listing URLs are supported');
  if (url.username || url.password) throw new Error('Listing URLs cannot contain credentials');
  url.hostname = url.hostname.toLowerCase();
  if (!isAllowedHost(url.hostname)) throw new Error('This listing website is not approved for import');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}

async function validatePublicDestination(url: string): Promise<void> {
  const hostname = new URL(url).hostname;
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error('Private network addresses are not allowed');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Listing host did not resolve to a public address');
  }
}

function numberValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function unwrapPayload(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) return (payload[0] || {}) as Record<string, unknown>;
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  for (const key of ['property', 'listing', 'result', 'data']) {
    const nested = record[key];
    if (Array.isArray(nested) && nested.length) return unwrapPayload(nested[0]);
    if (nested && typeof nested === 'object') return unwrapPayload(nested);
  }
  return record;
}

export function normalizeProviderPayload(payload: unknown, sourceUrl?: string): PropertyData {
  const value = unwrapPayload(payload);
  const addressValue = value.address;
  const address = addressValue && typeof addressValue === 'object' ? addressValue as Record<string, unknown> : {};
  const photosValue = firstValue(value.photos, value.images, value.imageUrls, value.image_urls, value.image);
  const photos = (Array.isArray(photosValue) ? photosValue : photosValue ? [photosValue] : [])
    .map((photo) => typeof photo === 'string' ? photo : stringValue((photo as Record<string, unknown>)?.url))
    .filter((photo): photo is string => Boolean(photo))
    .slice(0, 50);

  return {
    address: stringValue(firstValue(value.streetAddress, value.street_address, value.addressLine, value.address_line, address.streetAddress, address.line, typeof addressValue === 'string' ? addressValue : undefined)),
    city: stringValue(firstValue(value.city, value.locality, address.city, address.addressLocality)),
    state: stringValue(firstValue(value.state, value.stateCode, value.state_code, address.state, address.addressRegion)),
    zip: stringValue(firstValue(value.zip, value.zipcode, value.postcode, value.postalCode, value.postal_code, address.zipcode, address.postalCode)),
    price: numberValue(firstValue(value.price, value.listPrice, value.list_price)),
    beds: numberValue(firstValue(value.beds, value.bedrooms)),
    baths: numberValue(firstValue(value.baths, value.bathrooms)),
    sqft: numberValue(firstValue(value.sqft, value.squareFeet, value.square_feet, value.livingArea, value.living_area)),
    yearBuilt: numberValue(firstValue(value.yearBuilt, value.year_built)),
    lotSize: numberValue(firstValue(value.lotSize, value.lot_size, value.lotAcres, value.lot_acres)),
    propertyType: stringValue(firstValue(value.propertyType, value.property_type, value.style)),
    hoa: numberValue(firstValue(value.hoa, value.hoaFee, value.hoa_fee)),
    mlsId: stringValue(firstValue(value.mlsId, value.mls_id, value.mls)),
    description: stringValue(firstValue(value.description, value.text)),
    photos: photos.length ? photos : undefined,
    latitude: numberValue(firstValue(value.latitude, value.lat)),
    longitude: numberValue(firstValue(value.longitude, value.lng, value.lon)),
    sourceUrl: stringValue(firstValue(value.sourceUrl, value.source_url, value.url)) || sourceUrl,
  };
}

export function mergePropertyData(primary: PropertyData, fallback: PropertyData): PropertyData {
  const merged = { ...primary };
  for (const [key, value] of Object.entries(fallback)) {
    const current = merged[key as keyof PropertyData];
    if ((current === undefined || current === null || current === '' || (Array.isArray(current) && !current.length)) && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function listingCompleteness(property: PropertyData): number {
  const checks: Array<[boolean, number]> = [
    [Boolean(property.address), 15], [Boolean(property.city), 5], [Boolean(property.state), 5], [Boolean(property.zip), 5],
    [property.price !== undefined, 20], [property.beds !== undefined, 10], [property.baths !== undefined, 10],
    [property.sqft !== undefined, 10], [Boolean(property.photos?.length), 10],
    [property.latitude !== undefined && property.longitude !== undefined, 5], [Boolean(property.description), 5],
  ];
  return checks.reduce((score, [present, weight]) => score + (present ? weight : 0), 0);
}

function serviceUrl(name: string): string | undefined {
  return process.env[name]?.replace(/\/$/, '');
}

async function postService(baseUrl: string, path: string, body: unknown, apiKey?: string): Promise<unknown> {
  const response = await axios.post(`${baseUrl}${path}`, body, {
    timeout: 20_000,
    maxContentLength: 8 * 1024 * 1024,
    headers: apiKey ? { 'X-Api-Key': apiKey } : undefined,
  });
  return response.data;
}

const propertyWebProvider: ListingImportProvider = {
  name: 'property-web-scraper',
  enabled: () => Boolean(serviceUrl('PROPERTY_WEB_SCRAPER_URL')),
  extract: async (url) => normalizeProviderPayload(await postService(
    serviceUrl('PROPERTY_WEB_SCRAPER_URL')!,
    process.env.PROPERTY_WEB_SCRAPER_URL_PATH || '/public_api/v1/listings',
    { url },
    process.env.PROPERTY_WEB_SCRAPER_API_KEY,
  ), url),
};

const renderedHtmlProvider: ListingImportProvider = {
  name: 'playwright-rendered-html',
  enabled: () => Boolean(serviceUrl('PLAYWRIGHT_SERVICE_URL')),
  extract: async (url) => {
    const rendered = await postService(serviceUrl('PLAYWRIGHT_SERVICE_URL')!, process.env.PLAYWRIGHT_RENDER_PATH || '/render', { url });
    const html = typeof rendered === 'string' ? rendered : stringValue((rendered as Record<string, unknown>)?.html);
    if (!html) throw new Error('Renderer returned no HTML');
    const propertyWebUrl = serviceUrl('PROPERTY_WEB_SCRAPER_URL');
    if (propertyWebUrl) {
      return normalizeProviderPayload(await postService(
        propertyWebUrl,
        process.env.PROPERTY_WEB_SCRAPER_HTML_PATH || '/public_api/v1/listings',
        { html, url },
        process.env.PROPERTY_WEB_SCRAPER_API_KEY,
      ), url);
    }
    return { ...parsePropertyText(cheerio.load(html).text()), sourceUrl: url };
  },
};

const homeHarvestProvider: ListingImportProvider = {
  name: 'homeharvest',
  enabled: () => Boolean(serviceUrl('HOMEHARVEST_SERVICE_URL')),
  extract: async (url, current) => {
    if (!new URL(url).hostname.endsWith('realtor.com')) throw new Error('HomeHarvest is only used for Realtor.com enrichment');
    const location = [current.address, current.city, current.state, current.zip].filter(Boolean).join(', ');
    if (!location) throw new Error('An address is required for HomeHarvest enrichment');
    return normalizeProviderPayload(await postService(
      serviceUrl('HOMEHARVEST_SERVICE_URL')!,
      process.env.HOMEHARVEST_SEARCH_PATH || '/search',
      { location, listing_type: 'for_sale', limit: 5 },
    ), url);
  },
};

const existingParserProvider: ListingImportProvider = {
  name: 'built-in-parser',
  enabled: () => true,
  extract: (url) => scrapeProperty(url),
};

export const defaultListingImportProviders = [propertyWebProvider, renderedHtmlProvider, homeHarvestProvider, existingParserProvider];

export async function runProviderChain(url: string, providers: ListingImportProvider[]): Promise<Omit<ListingImportResult, 'importMeta'> & { attempts: ImportAttempt[]; providers: string[] }> {
  let property: PropertyData = { ...parseUrlFallback(url), sourceUrl: url };
  const attempts: ImportAttempt[] = [];
  const successfulProviders: string[] = [];

  for (const provider of providers) {
    if (listingCompleteness(property) >= COMPLETE_ENOUGH) break;
    if (!provider.enabled()) {
      attempts.push({ provider: provider.name, status: 'skipped', message: 'Not configured' });
      continue;
    }
    try {
      const extracted = await provider.extract(url, property);
      property = mergePropertyData(property, extracted);
      const complete = listingCompleteness(property);
      const useful = Object.values(extracted).some((value) => value !== undefined && value !== url);
      attempts.push({ provider: provider.name, status: useful ? (complete >= COMPLETE_ENOUGH ? 'success' : 'incomplete') : 'incomplete' });
      if (useful) successfulProviders.push(provider.name);
    } catch (error) {
      attempts.push({ provider: provider.name, status: 'failed', message: (error as Error).message });
    }
  }

  return { ...property, attempts, providers: successfulProviders };
}

export async function importListing(value: string): Promise<ListingImportResult> {
  const canonicalUrl = canonicalizeListingUrl(value);
  await validatePublicDestination(canonicalUrl);
  const cached = cache.get(canonicalUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, importMeta: { ...cached.result.importMeta, cached: true } };
  }

  const { attempts, providers, ...property } = await runProviderChain(canonicalUrl, defaultListingImportProviders);
  const completeness = listingCompleteness(property);
  const hasCoreData = Boolean(property.address && [property.price, property.beds, property.baths, property.sqft].some((value) => value !== undefined));
  if (!hasCoreData) {
    const error = new Error('The listing could not be extracted reliably. Paste the listing text or enter it manually.');
    (error as Error & { attempts?: ImportAttempt[] }).attempts = attempts;
    throw error;
  }

  const failedProviders = attempts.filter((attempt) => attempt.status === 'failed').map((attempt) => attempt.provider);
  const result: ListingImportResult = {
    ...property,
    sourceUrl: canonicalUrl,
    importMeta: {
      canonicalUrl,
      provider: providers.join(' + ') || 'built-in-parser',
      completeness,
      warnings: [
        ...(completeness < COMPLETE_ENOUGH ? ['Some listing fields are missing; review before saving.'] : []),
        ...(failedProviders.length ? [`Fallbacks were used after ${failedProviders.join(', ')} failed.`] : []),
      ],
      attempts,
      cached: false,
    },
  };
  cache.set(canonicalUrl, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}