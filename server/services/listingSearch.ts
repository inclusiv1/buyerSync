import { normalizeProviderPayload } from './listingImport';
import type { PropertyData } from './scraper';

export type ListingSearchInput = {
  location: string;
  limit: number;
  radius?: number;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  maxSqft?: number;
  lotSizeMin?: number;
  lotSizeMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  daysOld?: number;
  status?: 'Active' | 'Inactive';
  propertyType?: string;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const RENTCAST_PAGE_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const cache = new Map<string, { expiresAt: number; listings: PropertyData[] }>();
const US_STATE_ABBREVIATIONS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

function normalizedType(value: string | undefined): string {
  const normalized = (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = {
    home: '', homes: '', house: '', houses: '', residential: '', residentialhome: '', residentialhomes: '',
    singlefamilyhome: 'singlefamily', singlefamilyhomes: 'singlefamily', singlefamilyhouse: 'singlefamily', singlefamilyhouses: 'singlefamily',
    condominium: 'condo', condominiums: 'condo', condos: 'condo',
    townhome: 'townhouse', townhomes: 'townhouse', townhouses: 'townhouse',
    multifamilyhome: 'multifamily', multifamilyhomes: 'multifamily',
    manufacturedhome: 'manufactured', manufacturedhomes: 'manufactured', mobilehome: 'manufactured', mobilehomes: 'manufactured',
  };
  return aliases[normalized] ?? normalized;
}

function matchesFilters(listing: PropertyData, input: ListingSearchInput): boolean {
  if (input.minPrice !== undefined && (listing.price === undefined || listing.price < input.minPrice)) return false;
  if (input.maxPrice !== undefined && (listing.price === undefined || listing.price > input.maxPrice)) return false;
  if (input.minBeds !== undefined && (listing.beds === undefined || listing.beds < input.minBeds)) return false;
  if (input.minBaths !== undefined && (listing.baths === undefined || listing.baths < input.minBaths)) return false;
  if (input.minSqft !== undefined && (listing.sqft === undefined || listing.sqft < input.minSqft)) return false;
  if (input.maxSqft !== undefined && (listing.sqft === undefined || listing.sqft > input.maxSqft)) return false;
  if (input.lotSizeMin !== undefined && (listing.lotSize === undefined || listing.lotSize < input.lotSizeMin)) return false;
  if (input.lotSizeMax !== undefined && (listing.lotSize === undefined || listing.lotSize > input.lotSizeMax)) return false;
  if (input.yearBuiltMin !== undefined && (listing.yearBuilt === undefined || listing.yearBuilt < input.yearBuiltMin)) return false;
  if (input.yearBuiltMax !== undefined && (listing.yearBuilt === undefined || listing.yearBuilt > input.yearBuiltMax)) return false;
  const requestedType = normalizedType(input.propertyType);
  if (requestedType && normalizedType(listing.propertyType) !== requestedType) return false;
  return true;
}

function deduplicate(listings: PropertyData[]): PropertyData[] {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key = listing.mlsId
      ? `mls:${listing.mlsId}`
      : `address:${[listing.address, listing.city, listing.state, listing.zip].map(value => value?.toLowerCase().trim()).join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const RENTCAST_PROPERTY_TYPES = new Set(['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family', 'Apartment', 'Land']);

export function buildRentCastSearchUrl(input: ListingSearchInput, endpoint = 'https://api.rentcast.io/v1/listings/sale'): URL {
  const url = new URL(endpoint);
  const location = input.location.trim();
  const zip = location.match(/^\d{5}(?:-\d{4})?$/);
  const cityState = location.match(/^(.+?)(?:,\s*|\s+)([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  let hasAddressOrCoordinates = false;

  if (zip) {
    url.searchParams.set('zipCode', location);
  } else if (cityState && !/^\d/.test(cityState[1]) && US_STATE_ABBREVIATIONS.has(cityState[2].toUpperCase())) {
    url.searchParams.set('city', cityState[1].trim());
    url.searchParams.set('state', cityState[2].toUpperCase());
    if (cityState[3]) url.searchParams.set('zipCode', cityState[3]);
    hasAddressOrCoordinates = true;
  } else {
    url.searchParams.set('address', location);
    hasAddressOrCoordinates = true;
  }
  if (input.radius !== undefined && hasAddressOrCoordinates) {
    url.searchParams.set('radius', String(Math.min(input.radius, 100)));
  }
  if (input.propertyType && RENTCAST_PROPERTY_TYPES.has(input.propertyType)) {
    url.searchParams.set('propertyType', input.propertyType);
  }
  if (input.yearBuiltMin !== undefined || input.yearBuiltMax !== undefined) {
    url.searchParams.set('yearBuilt', `${input.yearBuiltMin ?? ''}-${input.yearBuiltMax ?? ''}`);
  }
  if (input.daysOld !== undefined) url.searchParams.set('daysOld', String(input.daysOld));
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    url.searchParams.set('price', `${input.minPrice ?? ''}-${input.maxPrice ?? ''}`);
  }
  url.searchParams.set('status', input.status ?? 'Active');
  url.searchParams.set('limit', String(RENTCAST_PAGE_SIZE));
  return url;
}

export async function searchRentCastListings(input: ListingSearchInput, fetcher: Fetcher = fetch): Promise<PropertyData[]> {
  const apiKey = process.env.RENTCAST_API_KEY?.trim();
  if (!apiKey) throw new Error('RentCast API key is not configured');
  const endpoint = process.env.RENTCAST_API_URL || 'https://api.rentcast.io/v1/listings/sale';
  const response = await fetcher(buildRentCastSearchUrl(input, endpoint), {
    headers: { 'X-Api-Key': apiKey, accept: 'application/json' },
    signal: AbortSignal.timeout(Number(process.env.RENTCAST_TIMEOUT_MS || 20_000)),
  });
  if (!response.ok) throw new Error(`RentCast returned ${response.status}`);
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error('RentCast returned an invalid response');
  return deduplicate(payload.map(listing => normalizeProviderPayload(listing)))
    .filter(listing => matchesFilters(listing, input))
    .slice(0, input.limit);
}

async function searchHomeHarvestListings(input: ListingSearchInput, fetcher: Fetcher): Promise<PropertyData[]> {
  const baseUrl = process.env.HOMEHARVEST_SERVICE_URL;
  if (!baseUrl) throw new Error('Listing search service is not configured');
  const serviceUrl = new URL(process.env.HOMEHARVEST_SEARCH_PATH || '/search', baseUrl);
  if (!['http:', 'https:'].includes(serviceUrl.protocol)) throw new Error('Listing search service must use HTTP or HTTPS');
  const response = await fetcher(serviceUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      location: input.location,
      listing_type: 'for_sale',
      limit: Math.min(input.limit, 25),
      min_price: input.minPrice,
      max_price: input.maxPrice,
      min_beds: input.minBeds,
      min_baths: input.minBaths,
      property_type: input.propertyType,
    }),
    signal: AbortSignal.timeout(Number(process.env.HOMEHARVEST_TIMEOUT_MS || 30_000)),
  });
  if (!response.ok) throw new Error(`Listing search service returned ${response.status}`);
  const payload = await response.json() as unknown;
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const results = Array.isArray(payload) ? payload : (record.data ?? record.results ?? record.listings);
  if (!Array.isArray(results)) throw new Error('Listing search service returned an invalid response');
  return deduplicate(results.map(listing => normalizeProviderPayload(listing)))
    .filter(listing => matchesFilters(listing, input))
    .slice(0, input.limit);
}

export async function searchPublicListings(input: ListingSearchInput, fetcher: Fetcher = fetch): Promise<PropertyData[]> {
  const provider = process.env.RENTCAST_API_KEY?.trim() ? 'rentcast' : 'homeharvest';
  const cacheKey = JSON.stringify([provider, input]);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.listings;

  let listings: PropertyData[];
  if (provider === 'rentcast') {
    try {
      listings = await searchRentCastListings(input, fetcher);
    } catch (error) {
      if (!process.env.HOMEHARVEST_SERVICE_URL) throw error;
      listings = await searchHomeHarvestListings(input, fetcher);
    }
  } else {
    listings = await searchHomeHarvestListings(input, fetcher);
  }
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, listings });
  return listings;
}