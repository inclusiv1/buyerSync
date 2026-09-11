import { z } from 'zod';
import { searchCriteriaPatchSchema } from '../services/assistant/contracts';

const emptyInputSchema = z.object({}).strict();
const httpUrlSchema = z.string().url().max(2_048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'URL must use HTTP or HTTPS');

export const toolInputSchemas = {
  get_search_profile: emptyInputSchema,
  update_search_criteria: searchCriteriaPatchSchema,
  list_checklist_requirements: emptyInputSchema,
  search_listings: z.object({
    location: z.string().trim().min(2).max(300),
    limit: z.number().int().min(1).max(25).default(10),
    minPrice: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    maxPrice: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    minBeds: z.number().int().nonnegative().max(100).optional(),
    minBaths: z.number().finite().nonnegative().max(100).optional(),
    propertyType: z.string().trim().min(1).max(80).optional(),
  }).strict().refine(
    ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { message: 'minPrice cannot exceed maxPrice' },
  ),
  import_listing: z.object({ url: httpUrlSchema }).strict(),
  rank_saved_properties: z.object({ limit: z.number().int().min(1).max(100).default(20) }).strict(),
  get_public_market_context: emptyInputSchema,
  get_visible_property_decision: z.object({ propertyId: z.string().trim().min(1).max(200) }).strict(),
} as const;

export type ToolName = keyof typeof toolInputSchemas;
