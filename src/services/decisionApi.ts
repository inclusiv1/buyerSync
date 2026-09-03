import api from '@/lib/api';
import type { CapExItem, Criterion, ScoreResult, ScoreSubmission, WalkthroughInspection } from '@/domain/models';

export interface PropertyDecisionData {
  scoreResult: ScoreResult;
  submissions: ScoreSubmission[];
  capExItems: CapExItem[];
  inspections: WalkthroughInspection[];
}

export type NewCriterion = Pick<Criterion, 'label' | 'description' | 'category' | 'weight' | 'scaleMax' | 'isDealbreaker'>;

export const decisionApi = {
  getCriteria: async (): Promise<Criterion[]> => (await api.get('/decision/criteria')).data,
  addCriterion: async (criterion: NewCriterion): Promise<Criterion> => (await api.post('/decision/criteria', criterion)).data,
  removeCriterion: async (criterionId: string): Promise<void> => {
    await api.delete(`/decision/criteria/${criterionId}`);
  },
  getPropertyDecision: async (listingId: string): Promise<PropertyDecisionData> =>
    (await api.get(`/properties/${listingId}/decision`)).data,
  submitScores: async (listingId: string, submission: Pick<ScoreSubmission, 'scores' | 'dealbreakers'>): Promise<PropertyDecisionData> =>
    (await api.post(`/properties/${listingId}/scores`, submission)).data,
  addCapEx: async (listingId: string, item: Omit<CapExItem, 'id' | 'listingId'>): Promise<CapExItem> =>
    (await api.post(`/properties/${listingId}/capex`, item)).data,
  removeCapEx: async (itemId: string): Promise<void> => {
    await api.delete(`/capex/${itemId}`);
  },
  addInspection: async (listingId: string, inspection: Omit<WalkthroughInspection, 'id' | 'listingId' | 'inspectedBy'>) =>
    (await api.post(`/properties/${listingId}/inspections`, inspection)).data,
  addAgentComment: async (listingId: string, inspectionId: string, comment: string) =>
    (await api.post(`/properties/${listingId}/agent-comments`, { inspectionId, comment })).data,
};