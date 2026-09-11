import { z } from 'zod';
import { searchCriteriaPatchSchema, rentCastPropertyTypes } from '../services/assistant/contracts';

const emptyInputSchema = z.object({}).strict();
const httpUrlSchema = z.string().url().max(2_048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'URL must use HTTP or HTTPS');

const searchResultListingSchema = z.object({
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  price: z.number().finite().nonnegative().optional(),
  beds: z.number().int().nonnegative().optional(),
  baths: z.number().finite().nonnegative().optional(),
  sqft: z.number().finite().nonnegative().optional(),
  yearBuilt: z.number().int().min(1000).max(3000).optional(),
  lotSize: z.number().finite().nonnegative().optional(),
  propertyType: z.string().trim().max(100).optional(),
  hoa: z.number().finite().nonnegative().optional(),
  mlsId: z.string().trim().min(1).max(100).optional(),
  photos: z.array(httpUrlSchema).max(50).optional(),
  description: z.string().trim().max(20_000).optional(),
  sourceUrl: httpUrlSchema.optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).strict();

export const toolInputSchemas = {
  get_search_profile: emptyInputSchema,
  update_search_criteria: searchCriteriaPatchSchema,
  list_checklist_requirements: emptyInputSchema,
  search_listings: z.object({
    location: z.string().trim().min(2).max(300)
      .describe('City and two-letter state abbreviation, ZIP code, or a street address. Prefer formats such as Smyrna, GA for a city search.'),
    radius: z.number().finite().positive().max(100).optional()
      .describe('Search radius in miles around location, up to 100. Requires location to be an address or city/state.'),
    limit: z.number().int().min(1).max(100).default(50),
    minPrice: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    maxPrice: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    minBeds: z.number().int().nonnegative().max(100).optional(),
    minBaths: z.number().finite().nonnegative().max(100).optional(),
    minSqft: z.number().finite().nonnegative().max(10_000_000).optional(),
    maxSqft: z.number().finite().nonnegative().max(10_000_000).optional(),
    lotSizeMin: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    lotSizeMax: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    yearBuiltMin: z.number().int().min(1000).max(3000).optional(),
    yearBuiltMax: z.number().int().min(1000).max(3000).optional(),
    daysOld: z.number().int().min(1).max(3650).optional()
      .describe('Maximum number of days since the property was listed.'),
    status: z.enum(['Active', 'Inactive']).optional(),
    propertyType: z.enum(rentCastPropertyTypes).optional()
      .describe('Optional specific type such as Single Family, Condo, Townhouse, or Multi-Family. Omit for generic homes, houses, or listings.'),
  }).strict().refine(
    ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { message: 'minPrice cannot exceed maxPrice' },
  ),
  import_listing: z.object({
    url: httpUrlSchema.optional(),
    listings: z.array(searchResultListingSchema).min(1).max(100).optional(),
  }).strict().refine(
    ({ url, listings }) => Boolean(url) !== Boolean(listings),
    { message: 'Provide either one URL or a batch of search-result listings' },
  ),
  rank_saved_properties: z.object({ limit: z.number().int().min(1).max(100).default(20) }).strict(),
  get_public_market_context: emptyInputSchema,
  get_visible_property_decision: z.object({ propertyId: z.string().trim().min(1).max(200) }).strict(),
} as const;

export type ToolName = keyof typeof toolInputSchemas;
