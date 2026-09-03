import axios from 'axios';
import * as cheerio from 'cheerio';

export interface PropertyData {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  photos?: string[];
  description?: string;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  hoa?: number;
  mlsId?: string;
  sourceUrl?: string;
  latitude?: number;
  longitude?: number;
}

const STREET_SUFFIXES = '(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way|Boulevard|Blvd|Highway|Hwy|Place|Pl|Trail|Trl|Parkway|Pkwy|Terrace|Ter|Loop|Cove|Cv|Run|Path|Alley|Aly|Crossing|Xing|Row|Point|Pt|Square|Sq|Ridge|Rdg|Pass|Trace|Bend|Walk)';
const UNIT_REGEX = '(?:\\s*(?:Apt|Unit|Suite|Ste|#)\\s*[A-Za-z0-9-]+)?';
const SUPPORTED_LISTING_HOSTS = ['zillow.com', 'realtor.com', 'redfin.com'];
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};
const NATIVE_BROWSER_HEADERS = {
  'User-Agent': BROWSER_HEADERS['User-Agent'],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': BROWSER_HEADERS['Accept-Language'],
};

function isSupportedListingUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && SUPPORTED_LISTING_HOSTS.some(
      host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

function mergeMissingPropertyData(property: PropertyData, fallback: PropertyData): void {
  for (const key of Object.keys(fallback) as (keyof PropertyData)[]) {
    const currentValue = property[key];
    if (currentValue === undefined || currentValue === null || currentValue === '') {
      (property as Record<string, unknown>)[key] = fallback[key];
    }
  }
}

function needsReaderFallback(property: PropertyData): boolean {
  return property.price === undefined || property.beds === undefined ||
    property.baths === undefined || property.sqft === undefined;
}

function readerResponseToText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';

  const response = data as { content?: unknown; data?: { content?: unknown } };
  if (typeof response.data?.content === 'string') return response.data.content;
  if (typeof response.content === 'string') return response.content;
  return JSON.stringify(data);
}

function normalizeListingRequestUrl(url: string): string {
  return url.replace(
    /(zillow\.com\/homedetails\/[^/?#]+\/)(\d+)(?:_zpid)?\/?(?=[?#]|$)/i,
    '$1$2_zpid/'
  );
}

function createZillowAddressSearchUrl(property: PropertyData): string | undefined {
  if (!property.address || !property.city || !property.state || !property.zip) return undefined;

  const slug = [property.address, property.city, property.state, property.zip]
    .join('-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.zillow.com/homes/${slug}_rb/`;
}

async function fetchListingHtml(url: string): Promise<string> {
  let requestUrl = url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(requestUrl, {
      headers: NATIVE_BROWSER_HEADERS,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw new Error('Listing redirected too many times');
      const nextUrl = new URL(location, requestUrl).toString();
      if (!isSupportedListingUrl(nextUrl)) throw new Error('Listing redirected to an unsupported host');
      requestUrl = nextUrl;
      continue;
    }
    if (!response.ok) throw new Error(`Request failed with status code ${response.status}`);
    return response.text();
  }
  throw new Error('Unable to fetch listing');
}

async function enrichFromReader(url: string, property: PropertyData): Promise<PropertyData> {
  if (!isSupportedListingUrl(url) || !needsReaderFallback(property)) return property;

  const authorization = process.env.JINA_API_KEY
    ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
    : {};

  for (let attempt = 0; attempt < 2 && needsReaderFallback(property); attempt += 1) {
    try {
      const { data } = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
          'X-Timeout': '30',
          ...(attempt > 0 ? { 'X-No-Cache': 'true' } : {}),
          ...authorization,
        },
        timeout: 45000,
      });
      const fallback = parsePropertyText(readerResponseToText(data));
      fallback.sourceUrl = url;
      mergeMissingPropertyData(property, fallback);
    } catch (error) {
      console.error(`Listing reader fallback attempt ${attempt + 1} failed:`, (error as Error).message);
    }
  }

  return property;
}

function parseBathsString(str: string): number | undefined {
  if (!str) return undefined;
  str = str.trim();
  const fracMatch = str.match(/^(\d+)\s+([1-3])\/([2-4])$/);
  if (fracMatch) {
    const whole = parseInt(fracMatch[1]);
    const num = parseInt(fracMatch[2]);
    const den = parseInt(fracMatch[3]);
    return whole + (num / den);
  }
  const val = parseFloat(str);
  return isNaN(val) ? undefined : val;
}

export function parseUrlFallback(url: string): Partial<PropertyData> {
  const property: Partial<PropertyData> = { sourceUrl: url };
  if (!url) return property;

  try {
    // 1. Zillow URLs
    // e.g. https://www.zillow.com/homedetails/123-Main-St-Austin-TX-78704/12345678_zpid/
    // or https://www.zillow.com/homes/123-Main-St-Austin-TX-78704_rb/12345678_zpid/
    const zillowMatch = url.match(/(?:homedetails|homes)\/([^/]+?)(?:_rb)?\/(\d+)(?:_zpid)?(?:[/?#]|$)/i);
    if (zillowMatch) {
      if (zillowMatch[2]) {
        property.mlsId = zillowMatch[2];
      }
      const slug = zillowMatch[1];
      // Format: 123-Main-St-Austin-TX-78704 or 123-Main-St-Apt-4B-Austin-TX-78704
      const parts = slug.split('-');
      // Check if last part is 5-digit zip and second to last is 2-letter state
      if (parts.length >= 4) {
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        if (/^\d{5}$/.test(last) && /^[A-Za-z]{2}$/.test(secondLast)) {
          property.zip = last;
          property.state = secondLast.toUpperCase();
          // City and street: look backwards for city
          // Usually city is 1 or 2 words before state
          property.city = parts[parts.length - 3].replace(/\+/g, ' ');
          const streetParts = parts.slice(0, parts.length - 3);
          property.address = streetParts.join(' ').replace(/\+/g, ' ');
        } else {
          property.address = slug.replace(/[-+]/g, ' ');
        }
      } else {
        property.address = slug.replace(/[-+]/g, ' ');
      }
      return property;
    }

    // 2. Realtor.com URLs
    // e.g. https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78704_M12345-67890
    // or https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78704
    const realtorMatch = url.match(/realestateandhomes-detail\/([^/?#]+)/i);
    if (realtorMatch) {
      const slug = realtorMatch[1];
      const underscoreParts = slug.split('_');
      if (underscoreParts.length >= 4) {
        // [123-Main-St, Austin, TX, 78704, M12345-67890]
        property.address = underscoreParts[0].replace(/[-+]/g, ' ');
        property.city = underscoreParts[1].replace(/[-+]/g, ' ');
        property.state = underscoreParts[2].toUpperCase();
        property.zip = underscoreParts[3].replace(/[-+]/g, '');
        if (underscoreParts[4]) {
          property.mlsId = underscoreParts[4];
        }
      } else if (underscoreParts.length >= 1) {
        property.address = underscoreParts[0].replace(/[-+]/g, ' ');
      }
      return property;
    }

    // 3. Redfin URLs
    // e.g. https://www.redfin.com/TX/Austin/123-Main-St-78704/home/12345678
    const redfinMatch = url.match(/redfin\.com\/([A-Za-z]{2})\/([^/]+)\/([^/]+)\/home\/(\d+)/i);
    if (redfinMatch) {
      property.state = redfinMatch[1].toUpperCase();
      property.city = redfinMatch[2].replace(/[-+]/g, ' ');
      const streetZip = redfinMatch[3].split('-');
      const last = streetZip[streetZip.length - 1];
      if (/^\d{5}$/.test(last)) {
        property.zip = last;
        property.address = streetZip.slice(0, -1).join(' ');
      } else {
        property.address = redfinMatch[3].replace(/[-+]/g, ' ');
      }
      property.mlsId = redfinMatch[4];
      return property;
    }
  } catch (_e) {}

  return property;
}

export function parsePropertyText(text: string): PropertyData {
  const property: PropertyData = {};
  if (!text) return property;

  // Clean and prepare lines
  const cleanText = text.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  // Check if text contains a URL and parse URL fallback first
  const urlMatch = cleanText.match(/(?:listing\s*url|property\s*url|source\s*url)\s*[:=-]?\s*((?:https?:\/\/|www\.)[^\s"'<>]+)/i)?.[1] ||
                   cleanText.match(/(?:https?:\/\/|www\.)[^\s"'<>]+/i)?.[0];
  if (urlMatch) {
    const normalizedUrl = `${urlMatch.startsWith('www.') ? 'https://' : ''}${urlMatch}`.replace(/[),.;]+$/, '');
    const urlData = parseUrlFallback(normalizedUrl);
    Object.assign(property, urlData);
  }

  // 1. Price
  // Match $1,234,567 or $1.2M or $450K or Price: $450,000
  const pricePrefixMatch = cleanText.match(/(?:price|list\s*price|est\.?\s*price|estimated\s*price)\s*[:=-]?\s*\$?\s*([0-9,]+(?:\.[0-9]+)?)\s*([KkMmB]illion|[KkMmB])?\b/i);
  if (pricePrefixMatch) {
    let price = parseFloat(pricePrefixMatch[1].replace(/,/g, ''));
    const unit = pricePrefixMatch[2]?.toLowerCase();
    if (unit?.startsWith('m')) price *= 1000000;
    else if (unit?.startsWith('k')) price *= 1000;
    property.price = price;
  } else {
    // Find all dollar amounts
    const dollarMatches = Array.from(cleanText.matchAll(/\$\s*([0-9,]+(?:\.[0-9]+)?)\s*([KkMmB]illion|[KkMmB])?\b/gi));
    for (const match of dollarMatches) {
      let price = parseFloat(match[1].replace(/,/g, ''));
      const unit = match[2]?.toLowerCase();
      if (unit?.startsWith('m')) price *= 1000000;
      else if (unit?.startsWith('k')) price *= 1000;
      // Skip typical rent/HOA values if they are explicitly marked per mo/month
      const matchIndex = match.index || 0;
      const followingStr = cleanText.slice(matchIndex, matchIndex + 30).toLowerCase();
      if ((followingStr.includes('/mo') || followingStr.includes('/month') || followingStr.includes('per month')) && price < 15000) {
        continue;
      }
      if (price > 10000 || unit) {
        property.price = price;
        break;
      } else if (!property.price) {
        property.price = price;
      }
    }
  }

  // 2. Bedrooms
  // Check "3 beds | 2 baths" or "4 bed" or "3 bd" or "3 BR" or "3-bed" or "Bedrooms: 3"
  // Prefix check first: "Bedrooms: 3", "Beds: 4"
  const bedsPrefixMatch = cleanText.match(/(?:^|[^\w])(?:beds?|bedrooms?|bds?|br)\s*[:=-]\s*(\d+)\b/i);
  const bedsSuffixMatch = cleanText.match(/\b(\d+)[^\S\r\n]*(?:-[^\S\r\n]*)?(?:beds?|bedrooms?|bds?|bd|br)\b/i);
  if (bedsPrefixMatch) {
    property.beds = parseInt(bedsPrefixMatch[1]);
  } else if (bedsSuffixMatch) {
    property.beds = parseInt(bedsSuffixMatch[1]);
  } else if (/\b(?:studio)\b/i.test(cleanText)) {
    property.beds = 0;
  } else {
    // Check multi-line: Line 1 = "3", Line 2 = "Beds" or Line 1 = "Beds", Line 2 = "3"
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d+$/.test(lines[i]) && /^(?:beds?|bedrooms?|bds?|bd|br)$/i.test(lines[i + 1])) {
        property.beds = parseInt(lines[i]);
        break;
      }
      if (/^(?:beds?|bedrooms?|bds?|bd|br)$/i.test(lines[i]) && /^\d+$/.test(lines[i + 1])) {
        property.beds = parseInt(lines[i + 1]);
        break;
      }
    }
  }

  // 3. Bathrooms
  // Check "2.5 baths", "2 bath", "2.5 ba", "2 1/2 baths", "Bathrooms: 2.5", "Bathrooms: 2 full"
  const bathsPrefixMatch = cleanText.match(/(?:^|[^\w])(?:baths?|bathrooms?|bths?|ba|bas)\s*[:=-]\s*(\d+(?:\.\d+)?|\d+\s+[1-3]\/[2-4])(?:\s*(?:full|ba|baths?))?\b/i);
  const bathsSuffixMatch = cleanText.match(/\b(\d+(?:\.\d+)?|\d+\s+[1-3]\/[2-4])[^\S\r\n]*(?:-[^\S\r\n]*)?(?:baths?|bathrooms?|bths?|ba|bas)\b/i);
  if (bathsPrefixMatch) {
    property.baths = parseBathsString(bathsPrefixMatch[1]);
  } else if (bathsSuffixMatch) {
    property.baths = parseBathsString(bathsSuffixMatch[1]);
  } else {
    // Check full and half bath breakdown: "2 full, 1 half" or "2 full baths"
    const fullMatch = cleanText.match(/(\d+)[^\S\r\n]*full(?:\s*baths?)?/i);
    const halfMatch = cleanText.match(/(\d+)[^\S\r\n]*half(?:\s*baths?)?/i);
    if (fullMatch || halfMatch) {
      const full = fullMatch ? parseInt(fullMatch[1]) : 0;
      const half = halfMatch ? parseInt(halfMatch[1]) : 0;
      property.baths = full + half * 0.5;
    } else {
      // Check multi-line: Line 1 = "2.5", Line 2 = "Baths"
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^(\d+(?:\.\d+)?|\d+\s+[1-3]\/[2-4])$/.test(lines[i]) && /^(?:baths?|bathrooms?|bths?|ba|bas)$/i.test(lines[i + 1])) {
          property.baths = parseBathsString(lines[i]);
          break;
        }
        if (/^(?:baths?|bathrooms?|bths?|ba|bas)$/i.test(lines[i]) && /^(\d+(?:\.\d+)?|\d+\s+[1-3]\/[2-4])$/.test(lines[i + 1])) {
          property.baths = parseBathsString(lines[i + 1]);
          break;
        }
      }
    }
  }

  // 4. Square Footage
  // Check "1,850 sqft", "2,400 sq ft", "1,500 square feet", "Sq Ft: 1,850", "Living Area: 1,850"
  const sqftPrefixMatch = cleanText.match(/(?:^|[^\w])(?:sqft|sq\s*ft|square\s*feet|square\s*foot|square\s*footage|living\s*area|total\s+(?:structure|interior\s+livable)\s+area|floor\s*size)\s*[:=-]\s*([0-9,]+(?:\.[0-9]+)?)\b/i);
  const sqftSuffixMatch = cleanText.match(/([0-9,]+(?:\.[0-9]+)?)[^\S\r\n]*(?:-[^\S\r\n]*)?(?:sqft|sq\.?\s*ft\.?|sf\b|square\s*feet|square\s*foot|square\s*footage)\b/i);
  if (sqftPrefixMatch) {
    const val = parseFloat(sqftPrefixMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 10) property.sqft = val;
  } else if (sqftSuffixMatch) {
    const val = parseFloat(sqftSuffixMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 10) property.sqft = val;
  } else {
    // Multi-line
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^[0-9,]+$/.test(lines[i]) && /^(?:sqft|sq\.?\s*ft\.?|square\s*feet|living\s*area)$/i.test(lines[i + 1])) {
        const val = parseFloat(lines[i].replace(/,/g, ''));
        if (!isNaN(val) && val > 10) {
          property.sqft = val;
          break;
        }
      }
      if (/^(?:sqft|sq\.?\s*ft\.?|square\s*feet|living\s*area)$/i.test(lines[i]) && /^[0-9,]+$/.test(lines[i + 1])) {
        const val = parseFloat(lines[i + 1].replace(/,/g, ''));
        if (!isNaN(val) && val > 10) {
          property.sqft = val;
          break;
        }
      }
    }
  }

  // 5. Year Built
  const yearMatch = cleanText.match(/(?:year\s*built|yr\s*built|built\s*in|built)\s*[:=-]?\s*(\d{4})\b/i);
  if (yearMatch) {
    const yr = parseInt(yearMatch[1]);
    if (yr >= 1800 && yr <= 2050) property.yearBuilt = yr;
  }

  // 6. Lot Size
  const lotPrefixMatch = cleanText.match(/(?:lot\s*size|lot\s*area|lot)\s*[:=-]?\s*([0-9,]+(?:\.[0-9]+)?)\s*(acres?|ac\b|sq\.?\s*ft\.?|square\s*(?:feet|foot))?/i);
  const acreMatch = cleanText.match(/([0-9,]+(?:\.[0-9]+)?)[^\S\r\n]*(?:-[^\S\r\n]*)?(?:acres?|ac\b|acre\s*lot)\b/i);
  if (lotPrefixMatch) {
    const lot = parseFloat(lotPrefixMatch[1].replace(/,/g, ''));
    const unit = lotPrefixMatch[2]?.toLowerCase();
    if (!isNaN(lot)) {
      property.lotSize = unit?.includes('sq') || unit?.startsWith('square')
        ? Math.round((lot / 43560) * 100) / 100
        : lot;
    }
  } else if (acreMatch) {
    const lot = parseFloat(acreMatch[1].replace(/,/g, ''));
    if (!isNaN(lot)) property.lotSize = lot;
  } else {
    const lotSqftMatch = cleanText.match(/([0-9,]+)[^\S\r\n]*(?:sqft|sq\s*ft)\s*lot\b/i);
    if (lotSqftMatch) {
      const sqftLot = parseFloat(lotSqftMatch[1].replace(/,/g, ''));
      if (!isNaN(sqftLot)) property.lotSize = Math.round((sqftLot / 43560) * 100) / 100;
    } else {
      // Multi-line lot size: Line 1 = "0.76", Line 2 = "Acre Lot" or "Acres"
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^[0-9.]+(?:\s*[KkMm])?$/.test(lines[i]) && /^(?:acres?|acre\s*lot|lot\s*size)$/i.test(lines[i + 1])) {
          const val = parseFloat(lines[i]);
          if (!isNaN(val)) {
            property.lotSize = val;
            break;
          }
        }
      }
    }
  }

  // 7. HOA
  const noHoaMatch = cleanText.match(/(?:no\s*hoa|hoa(?:\s*fees?|\s*dues)?\s*[:=-]?\s*none|\$0\s*hoa)/i);
  if (noHoaMatch) {
    property.hoa = 0;
  } else {
    const hoaMatch = cleanText.match(/\$\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:\/|\s*per\s*)?(mo|month|mth|monthly)\s*(?:hoa|association\s*(?:fee|dues))/i) ||
                     cleanText.match(/(?:monthly\s*hoa|hoa(?:\s*(?:fees?|dues?))?|association\s*(?:fees?|dues?))\s*[:=-]?\s*\$?\s*([0-9,]+(?:\.[0-9]+)?)(?:\s*(?:\/|\s*per\s*)?(mo|month|mth|monthly|annual|annually|year|yearly|yr))?/i);
    if (hoaMatch) {
      const hoaVal = parseFloat(hoaMatch[1].replace(/,/g, ''));
      const frequency = hoaMatch[2]?.toLowerCase();
      if (!isNaN(hoaVal)) {
        property.hoa = frequency && /^(?:annual|annually|year|yearly|yr)$/.test(frequency)
          ? Math.round((hoaVal / 12) * 100) / 100
          : hoaVal;
      }
    }
  }

  // 8. Property Type
  const propTypeMatch = cleanText.match(/(?:property\s*(?:sub\s*)?type|home\s*type)\s*[:=-]?\s*([^\n|]+)/i);
  if (propTypeMatch) {
    property.propertyType = propTypeMatch[1].trim();
  } else if (/\b(?:single\s*family(?:\s*home|\s*residence)?)\b/i.test(cleanText)) {
    property.propertyType = 'Single Family';
  } else if (/\b(?:townhouse|townhome)\b/i.test(cleanText)) {
    property.propertyType = 'Townhouse';
  } else if (/\b(?:condo|condominium)\b/i.test(cleanText)) {
    property.propertyType = 'Condo';
  } else if (/\b(?:multi-family|multi\s*family|duplex|triplex|fourplex)\b/i.test(cleanText)) {
    property.propertyType = 'Multi-Family';
  } else if (/\b(?:co-op|cooperative)\b/i.test(cleanText)) {
    property.propertyType = 'Co-op';
  } else if (/\b(?:apartment)\b/i.test(cleanText)) {
    property.propertyType = 'Apartment';
  } else if (/\b(?:manufactured|mobile\s*home)\b/i.test(cleanText)) {
    property.propertyType = 'Manufactured';
  } else if (/\b(?:vacant\s*land|vacant\s*lot|raw\s*land)\b/i.test(cleanText)) {
    property.propertyType = 'Land';
  }

  // 9. MLS ID
  const mlsMatch = cleanText.match(/(?:mls\s*id\s*#?|mls\s*number\s*#?|mls\s*#|mls\s*[:=-]|mls\b|source\s*id)\s*[:=-]?\s*([A-Za-z0-9-]+)\b/i);
  if (mlsMatch) {
    property.mlsId = mlsMatch[1].trim();
  }

  // 10. Listing description / public remarks
  const descriptionLabelIndex = lines.findIndex(line => /^(?:what['’]s special|description|public remarks|property description)\s*:?(?:\s+.*)?$/i.test(line));
  if (descriptionLabelIndex >= 0) {
    const labelLine = lines[descriptionLabelIndex];
    const inlineDescription = labelLine.match(/^(?:description|public remarks|property description)\s*:\s*(.+)$/i)?.[1];
    const descriptionLines = inlineDescription ? [inlineDescription] : [];
    const descriptionStops = /^(?:show more|show less|facts\s*&\s*features|listing (?:provided by|details|updated)|property details|price history|home details|\d+\s+days?\s+on\s+(?:zillow|market))$/i;

    for (let i = descriptionLabelIndex + 1; i < lines.length; i++) {
      if (descriptionStops.test(lines[i])) break;
      descriptionLines.push(lines[i]);
    }

    const description = descriptionLines.join(' ').trim();
    if (description) property.description = description;
  }

  // 11. Address / City / State / Zip
  if (!property.address || !property.city || !property.state) {
    // Check single line standard format: "123 Main St, Austin, TX 78704" or "123 Main St Apt 4B, Austin, TX"
    const singleLineRegex = new RegExp(
      `^([0-9]{1,6}\\s+[A-Za-z0-9\\s.,#-]+?${STREET_SUFFIXES}\\.?${UNIT_REGEX})[\\s,]+([A-Za-z\\s]{2,30})[\\s,]+([A-Za-z]{2})\\s*(\\d{5}(?:-\\d{4})?)?$`,
      'i'
    );

    for (const line of lines) {
      const match = line.match(singleLineRegex);
      if (match) {
        property.address = match[1].trim().replace(/,\s*$/, '');
        property.city = match[2].trim().replace(/,\s*$/, '');
        property.state = match[3].trim().toUpperCase();
        if (match[4]) property.zip = match[4].trim();
        break;
      }
    }
  }

  // Two-line address matching: Line 1 = "123 Main St", Line 2 = "Austin, TX 78704"
  if (!property.address || !property.city || !property.state) {
    const streetLineRegex = new RegExp(`^[0-9]{1,6}\\s+[A-Za-z0-9\\s.,#-]+?${STREET_SUFFIXES}\\.?${UNIT_REGEX}$`, 'i');
    const cszLineRegex = /^([A-Za-z\s]{2,30})[,\s]+([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (streetLineRegex.test(line)) {
        property.address = property.address || line.trim();
        const nextLine = lines[i + 1] || '';
        const cszMatch = nextLine.match(cszLineRegex);
        if (cszMatch) {
          property.city = cszMatch[1].trim().replace(/,\s*$/, '');
          property.state = cszMatch[2].trim().toUpperCase();
          if (cszMatch[3]) property.zip = cszMatch[3].trim();
        }
        break;
      }
    }
  }

  // Fallback line search for street address
  if (!property.address) {
    const generalStreetRegex = new RegExp(`\\b\\d{1,6}\\s+[A-Za-z0-9\\s.,#-]+?${STREET_SUFFIXES}\\b${UNIT_REGEX}`, 'i');
    for (const line of lines) {
      const match = line.match(generalStreetRegex);
      if (match) {
        property.address = match[0].trim();
        const cszRegex = /([A-Za-z\s]{2,})\s*,\s*([A-Za-z]{2})\s*(\d{5})?/;
        const cszMatch = line.match(cszRegex) || (lines[lines.indexOf(line) + 1] || '').match(cszRegex);
        if (cszMatch) {
          property.city = property.city || cszMatch[1].trim();
          property.state = property.state || cszMatch[2].trim().toUpperCase();
          if (cszMatch[3]) property.zip = property.zip || cszMatch[3].trim();
        }
        break;
      }
    }
  }

  return property;
}

export async function scrapeProperty(url: string): Promise<PropertyData> {
  const property: PropertyData = parseUrlFallback(url);
  const requestUrl = normalizeListingRequestUrl(url);

  try {
    let data: string;
    try {
      const response = await axios.get(requestUrl, {
        headers: BROWSER_HEADERS,
        timeout: 10000,
        maxRedirects: 0,
      });
      data = response.data;
    } catch (axiosError) {
      console.error('Axios listing request failed, trying native client:', (axiosError as Error).message);
      try {
        data = await fetchListingHtml(requestUrl);
      } catch (nativeError) {
        const zillowSearchUrl = new URL(url).hostname.endsWith('realtor.com')
          ? createZillowAddressSearchUrl(property)
          : undefined;
        if (!zillowSearchUrl) throw nativeError;
        console.error('Direct Realtor request failed, trying Zillow address search:', (nativeError as Error).message);
        data = await fetchListingHtml(zillowSearchUrl);
      }
    }
    const $ = cheerio.load(data);

    // 1. Try __NEXT_DATA__ (Zillow, Realtor.com, Redfin)
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const json = JSON.parse(nextDataScript);
        const pageProps = json.props?.pageProps;

        // Zillow GDP cache
        let details = pageProps?.property || pageProps?.initialData?.building || pageProps?.listing;
        if (!details && pageProps?.componentProps?.gdpClientCache) {
          try {
            const cache = typeof pageProps.componentProps.gdpClientCache === 'string'
              ? JSON.parse(pageProps.componentProps.gdpClientCache)
              : pageProps.componentProps.gdpClientCache;
            const cacheEntry = Object.entries(cache || {}).find(([key, value]) =>
              (key.includes('ForSale') || key.includes('Property') || key.includes('zpid')) &&
              value && typeof value === 'object' && 'property' in value
            ) as [string, { property: unknown }] | undefined;
            if (cacheEntry) {
              details = cacheEntry[1].property;
            }
          } catch (e) {}
        }

        // Realtor.com initialReduxState
        if (!details && pageProps?.initialReduxState?.property) {
          details = pageProps.initialReduxState.property;
        }

        if (details) {
          // Address
          const addr = details.address || details.location?.address;
          if (addr) {
            property.address = addr.streetAddress || addr.line || property.address;
            property.city = addr.city || property.city;
            property.state = addr.state || addr.state_code || property.state;
            property.zip = addr.zipcode || addr.postal_code || property.zip;
          }

          // Price
          property.price = details.price || details.list_price || details.resoFacts?.price || property.price;

          property.latitude = details.latitude || details.latLong?.latitude || details.location?.address?.coordinate?.lat || property.latitude;
          property.longitude = details.longitude || details.latLong?.longitude || details.location?.address?.coordinate?.lon || property.longitude;

          // Beds
          property.beds = details.bedrooms || details.resoFacts?.bedrooms || details.description?.beds || details.description?.beds_min || property.beds;

          // Baths
          const bathsVal = details.bathrooms || details.resoFacts?.bathrooms || details.description?.baths;
          if (bathsVal !== undefined && bathsVal !== null) {
            property.baths = bathsVal;
          } else if (details.bathroomsFull !== undefined || details.description?.baths_full !== undefined) {
            const full = details.bathroomsFull || details.description?.baths_full || 0;
            const half = details.bathroomsHalf || details.description?.baths_half || 0;
            property.baths = full + half * 0.5;
          }

          // Sqft
          property.sqft = details.livingArea || details.resoFacts?.livingArea || details.livingAreaValue || details.description?.sqft || property.sqft;

          // Year Built
          property.yearBuilt = details.yearBuilt || details.resoFacts?.yearBuilt || details.description?.year_built || property.yearBuilt;

          // Lot Size
          const lotVal = details.resoFacts?.lotSize || details.lotSize || details.description?.lot_acres;
          if (lotVal) property.lotSize = lotVal;

          // Property Type
          property.propertyType = details.homeType || details.resoFacts?.homeType || details.description?.type || property.propertyType;

          // HOA
          property.hoa = details.monthlyHoaFee || details.resoFacts?.hoaFee || details.hoa?.fee || property.hoa;

          // MLS ID
          property.mlsId = details.attributionInfo?.mlsId || details.resoFacts?.mlsId || details.mls?.id || property.mlsId;

          // Photos
          if (details.photos && Array.isArray(details.photos)) {
            property.photos = details.photos.map((p: any) => {
              if (typeof p === 'string') return p;
              return p.mixedSources?.jpeg?.[0]?.url || p.url || p.href?.replace('{size}', 'od-w1024') || p.href;
            }).filter(Boolean);
          }

          // Description
          property.description = details.description?.text || details.description || property.description;
        }
      } catch (e) {}
    }

    // 2. Structured data (JSON-LD)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html() || '{}';
        const parsed = JSON.parse(content);
        const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

        for (const item of list) {
          if (!item || typeof item !== 'object') continue;
          const type = item['@type'];
          if (
            type === 'RealEstateListing' ||
            type === 'Product' ||
            type === 'SingleFamilyResidence' ||
            type === 'Residence' ||
            type === 'House' ||
            type === 'Apartment' ||
            type === 'Place' ||
            type === 'Accommodation'
          ) {
            // Address
            if (item.address) {
              if (typeof item.address === 'object') {
                property.address = property.address || item.address.streetAddress;
                property.city = property.city || item.address.addressLocality;
                property.state = property.state || item.address.addressRegion;
                property.zip = property.zip || item.address.postalCode;
              } else if (typeof item.address === 'string') {
                const parsedAddr = parsePropertyText(item.address);
                property.address = property.address || parsedAddr.address;
                property.city = property.city || parsedAddr.city;
                property.state = property.state || parsedAddr.state;
                property.zip = property.zip || parsedAddr.zip;
              }
            }

            // Description
            property.description = property.description || item.description;

            if (item.geo) {
              property.latitude = property.latitude || Number(item.geo.latitude) || undefined;
              property.longitude = property.longitude || Number(item.geo.longitude) || undefined;
            }

            // Price
            if (item.offers) {
              const offerPrice = item.offers.price || item.offers.priceSpecification?.price;
              if (offerPrice) property.price = property.price || parseFloat(offerPrice);
            }

            // Beds, Baths, Sqft, Year
            if (item.numberOfBedrooms) property.beds = property.beds || parseInt(item.numberOfBedrooms);
            if (item.numberOfRooms && !property.beds) property.beds = parseInt(item.numberOfRooms);
            if (item.numberOfBathroomsTotal) property.baths = property.baths || parseFloat(item.numberOfBathroomsTotal);
            if (item.numberOfFullBathrooms && !property.baths) property.baths = parseFloat(item.numberOfFullBathrooms);
            if (item.floorSize) {
              const fs = typeof item.floorSize === 'object' ? item.floorSize.value : item.floorSize;
              if (fs) property.sqft = property.sqft || parseFloat(fs);
            }
            if (item.yearBuilt) property.yearBuilt = property.yearBuilt || parseInt(item.yearBuilt);

            // Photos
            if (item.image && !property.photos) {
              if (Array.isArray(item.image)) {
                property.photos = item.image.map((img: any) => typeof img === 'string' ? img : img.url || img.contentUrl).filter(Boolean);
              } else if (typeof item.image === 'string') {
                property.photos = [item.image];
              } else if (item.image.url) {
                property.photos = [item.image.url];
              }
            }
          }
        }
      } catch (e) {}
    });

    // 3. Open Graph & Meta Tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');

    if (ogImage && (!property.photos || property.photos.length === 0)) {
      property.photos = [ogImage];
    }

    // Parse title and description text with parsePropertyText
    if (ogDesc) {
      const parsedDesc = parsePropertyText(ogDesc);
      property.price = property.price || parsedDesc.price;
      property.beds = property.beds !== undefined ? property.beds : parsedDesc.beds;
      property.baths = property.baths !== undefined ? property.baths : parsedDesc.baths;
      property.sqft = property.sqft || parsedDesc.sqft;
      property.yearBuilt = property.yearBuilt || parsedDesc.yearBuilt;
      property.lotSize = property.lotSize || parsedDesc.lotSize;
      property.propertyType = property.propertyType || parsedDesc.propertyType;
      property.hoa = property.hoa !== undefined ? property.hoa : parsedDesc.hoa;
      property.mlsId = property.mlsId || parsedDesc.mlsId;
      property.address = property.address || parsedDesc.address;
      property.city = property.city || parsedDesc.city;
      property.state = property.state || parsedDesc.state;
      property.zip = property.zip || parsedDesc.zip;
      if (!property.description) property.description = ogDesc;
    }

    if (ogTitle) {
      const parsedTitle = parsePropertyText(ogTitle);
      property.address = property.address || parsedTitle.address;
      property.city = property.city || parsedTitle.city;
      property.state = property.state || parsedTitle.state;
      property.zip = property.zip || parsedTitle.zip;
      property.price = property.price || parsedTitle.price;
      property.beds = property.beds !== undefined ? property.beds : parsedTitle.beds;
      property.baths = property.baths !== undefined ? property.baths : parsedTitle.baths;
      property.sqft = property.sqft || parsedTitle.sqft;
    }

    // 4. Fallback: Parse whole page text if critical fields are still missing
    if (property.beds === undefined || property.baths === undefined || property.sqft === undefined || !property.price) {
      const bodyText = $('body').text();
      const parsedBody = parsePropertyText(bodyText);
      if (property.beds === undefined) property.beds = parsedBody.beds;
      if (property.baths === undefined) property.baths = parsedBody.baths;
      if (!property.sqft) property.sqft = parsedBody.sqft;
      if (!property.price) property.price = parsedBody.price;
      if (!property.yearBuilt) property.yearBuilt = parsedBody.yearBuilt;
      if (!property.lotSize) property.lotSize = parsedBody.lotSize;
      if (!property.propertyType) property.propertyType = parsedBody.propertyType;
      if (property.hoa === undefined) property.hoa = parsedBody.hoa;
      if (!property.mlsId) property.mlsId = parsedBody.mlsId;
      if (!property.address) property.address = parsedBody.address;
      if (!property.city) property.city = parsedBody.city;
      if (!property.state) property.state = parsedBody.state;
      if (!property.zip) property.zip = parsedBody.zip;
    }

    return enrichFromReader(url, property);
  } catch (error) {
    console.error('Direct listing request failed, trying reader fallback:', (error as Error).message);
    return enrichFromReader(url, property);
  }
}
