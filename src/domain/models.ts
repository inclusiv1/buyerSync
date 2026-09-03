export type UserRole = 'primary_buyer' | 'co_buyer' | 'agent';

export interface UserSummary {
  id: string;
  name: string;
  role: UserRole;
}

export type CriterionCategory = 'location' | 'layout-size' | 'condition' | 'aesthetics' | 'financial' | 'custom';

export interface Criterion {
  id: string;
  groupId: string;
  label: string;
  description?: string;
  category: CriterionCategory;
  weight: number;
  scaleMax: 5 | 10;
  isDealbreaker: boolean;
  createdAt?: string;
}

export interface CriterionRating {
  criterionId: string;
  value: number;
}

export interface DealbreakerRating {
  criterionId: string;
  triggered: boolean;
  note?: string;
}

export interface ScoreSubmission {
  id?: string;
  listingId: string;
  user: UserSummary;
  scores: CriterionRating[];
  dealbreakers: DealbreakerRating[];
  submittedAt: string;
  isSubmitted: boolean;
}

export interface DealbreakerResult {
  criterionId: string;
  label: string;
  userId: string;
  userName: string;
  note?: string;
}

export interface RaterScore {
  userId: string;
  userName: string;
  role: UserRole;
  score: number;
}

export interface ScoreResult {
  compositeScore: number | null;
  divergence: number;
  maxDivergence: number;
  hasVeto: boolean;
  vetoes: DealbreakerResult[];
  blind: boolean;
  revealed: boolean;
  raterScores: RaterScore[];
  criterionDivergence: Record<string, number>;
}

export type InspectionCondition = 'good' | 'fair' | 'poor' | 'not-inspected';
export type InspectionSection = 'exterior' | 'foundation-roof' | 'hvac-plumbing' | 'kitchen' | 'primary-suite' | 'yard';

export interface InspectionMedia {
  id: string;
  url: string;
  type: 'photo' | 'video';
  caption?: string;
  roomTag?: string;
  checklistItemId?: string;
  uploadedBy: string;
}

export interface InspectionItem {
  id: string;
  label: string;
  condition: InspectionCondition;
  issueFlags: string[];
  notes?: string;
  media: InspectionMedia[];
}

export interface WalkthroughInspection {
  id: string;
  listingId: string;
  section: InspectionSection;
  inspectedBy: UserSummary;
  inspectedAt: string;
  items: InspectionItem[];
  agentComment?: string;
}

export interface CapExItem {
  id: string;
  listingId: string;
  label: string;
  estimatedCost: number;
  priority: 'immediate' | 'year-one' | 'future';
  sourceInspectionItemId?: string;
  notes?: string;
}

export interface FinancialAssumptions {
  purchasePrice: number;
  downPaymentPercent: number;
  annualInterestRate: number;
  loanTermYears: number;
  annualPropertyTaxes: number;
  annualHomeownersInsurance: number;
  monthlyHoa: number;
  monthlyUtilities: number;
}

export interface PropertyNote {
  id: string;
  body: string;
  visitDate?: string | null;
  createdAt: string;
  author: Pick<UserSummary, 'id' | 'name'>;
}

export interface MonthlyCostBreakdown {
  principalAndInterest: number;
  propertyTaxes: number;
  homeownersInsurance: number;
  hoa: number;
  utilities: number;
  total: number;
}

export interface Listing {
  id: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  price: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  hoa?: number;
  photos?: string[] | string | null;
  score?: number;
  pros: string[];
  cons: string[];
  notes: PropertyNote[];
  financials: FinancialAssumptions;
  capExItems: CapExItem[];
  scoreResult: ScoreResult;
}