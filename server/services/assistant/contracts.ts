import { z } from 'zod';

const boundedNullableNumber = (maximum: number) => z.number().finite().min(0).max(maximum).nullable().optional();
const boundedNullableInteger = (maximum: number) => z.number().int().min(0).max(maximum).nullable().optional();
const httpUrlSchema = z.string().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'URL must use HTTP or HTTPS');

export const rentCastPropertyTypes = ['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family', 'Apartment', 'Land'] as const;
export const listingTypeOptions = ['By Agent', 'By Owner', 'New Construction', 'Foreclosures', 'Coming Soon', 'Auction', 'Accepted Offer'] as const;
export const homeFeatureOptions = ['Parking', 'Garage', 'Basement', 'Single Story', 'Pool', 'Waterfront', 'Air Conditioning', 'Fireplace', '3D or video tour', 'Open House', 'Price Reduced'] as const;

export const searchCriteriaPatchSchema = z.object({
  location: z.string().trim().min(2).max(300).nullable().optional()
    .describe('City and two-letter state abbreviation, ZIP code, or a street address, such as Smyrna, GA.'),
  radius: boundedNullableNumber(100)
    .describe('Search radius in miles from the location, up to 100. Requires an address or coordinates.'),
  minPrice: boundedNullableNumber(1_000_000_000),
  maxPrice: boundedNullableNumber(1_000_000_000),
  minBeds: boundedNullableInteger(100),
  maxBeds: boundedNullableInteger(100),
  minBaths: boundedNullableNumber(100),
  minSqft: boundedNullableNumber(10_000_000),
  maxSqft: boundedNullableNumber(10_000_000),
  propertyTypes: z.array(z.enum(rentCastPropertyTypes)).max(20).nullable().optional(),
  listingTypes: z.array(z.enum(listingTypeOptions)).max(20).nullable().optional(),
  homeFeatures: z.array(z.enum(homeFeatureOptions)).max(20).nullable().optional(),
  keywords: z.string().trim().max(300).nullable().optional(),
  yearBuiltMin: boundedNullableInteger(3000),
  yearBuiltMax: boundedNullableInteger(3000),
  lotSizeMin: boundedNullableNumber(1_000_000_000),
  lotSizeMax: boundedNullableNumber(1_000_000_000),
  hoaMax: boundedNullableNumber(10_000_000),
  schoolRating: boundedNullableInteger(10),
  status: z.enum(['Active', 'Inactive']).nullable().optional(),
  daysOld: boundedNullableInteger(3650)
    .describe('Maximum number of days since the property was listed.'),
}).strict();

export type SearchCriteriaPatch = z.infer<typeof searchCriteriaPatchSchema>;

export const citationSchema = z.object({
  sourceName: z.string().trim().min(1).max(160),
  url: httpUrlSchema,
  title: z.string().trim().min(1).max(300).optional(),
  observationDate: z.string().date().nullable().optional(),
  retrievedAt: z.string().datetime({ offset: true }),
  claim: z.string().trim().min(1).max(1_000).optional(),
  uncertainty: z.enum(['low', 'medium', 'high', 'unknown']).optional(),
}).strict();

export type Citation = z.infer<typeof citationSchema>;

export const toolSummarySchema = z.object({
  toolRunId: z.string().uuid(),
  toolName: z.string().trim().min(1).max(120),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']),
  isWrite: z.boolean(),
  summary: z.string().trim().min(1).max(2_000).optional(),
  errorCategory: z.string().trim().min(1).max(120).optional(),
}).strict();

export type ToolSummary = z.infer<typeof toolSummarySchema>;

const paginationFields = {
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const threadPaginationSchema = z.object({
  ...paginationFields,
  status: z.enum(['active', 'archived']).optional(),
}).strict();

export type ThreadPagination = z.infer<typeof threadPaginationSchema>;

export const messagePaginationSchema = z.object(paginationFields).strict();

export type MessagePagination = z.infer<typeof messagePaginationSchema>;

export const threadCreateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
}).strict();

export type ThreadCreate = z.infer<typeof threadCreateSchema>;

export const assistantTurnRequestSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
  idempotencyKey: z.string().trim().min(1).max(200),
}).strict();

export type AssistantTurnRequest = z.infer<typeof assistantTurnRequestSchema>;