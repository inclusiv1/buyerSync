export type DecisionRating = {
  userId: string;
  criterionId: string;
  value: number;
  dealbreakerTriggered: boolean;
};

export type DecisionRater = {
  userId: string;
  userName: string;
  role: string;
};

export type ScoringCriterion = {
  id: string;
  label: string;
  weight: number;
  scaleMax: 5 | 10;
  isDealbreaker: boolean;
};

const round = (value: number) => Number(value.toFixed(1));

export function buildDecisionResult(
  buyers: DecisionRater[],
  submittedUserIds: string[],
  ratings: DecisionRating[],
  criteria: ScoringCriterion[],
) {
  const submitted = new Set(submittedUserIds);
  const buyerIdSet = new Set(buyers.map(buyer => buyer.userId));
  const buyerRatings = ratings.filter(rating => buyerIdSet.has(rating.userId));
  const revealed = buyers.length > 0 && buyers.every(buyer => submitted.has(buyer.userId));
  if (!revealed) {
    return {
      compositeScore: null,
      divergence: 0,
      maxDivergence: 0,
      hasVeto: false,
      vetoes: [] as Array<{ criterionId: string; label: string; userId: string; userName: string }>,
      blind: true,
      revealed: false,
      raterScores: [] as Array<{ userId: string; userName: string; role: string; score: number }>,
      criterionDivergence: {} as Record<string, number>,
    };
  }

  const scoringCriteria = criteria.filter(criterion => !criterion.isDealbreaker && criterion.weight > 0);
  const criterionById = new Map(criteria.map(criterion => [criterion.id, criterion]));
  const raterScores = buyers.map(buyer => {
    let weightedTotal = 0;
    let availableWeight = 0;
    for (const criterion of scoringCriteria) {
      const rating = buyerRatings.find(item => item.userId === buyer.userId && item.criterionId === criterion.id);
      if (!rating) continue;
      weightedTotal += (rating.value / criterion.scaleMax) * criterion.weight;
      availableWeight += criterion.weight;
    }
    return {
      ...buyer,
      score: availableWeight ? round((weightedTotal / availableWeight) * 100) : 0,
    };
  });
  const scores = raterScores.map(rater => rater.score);
  const compositeScore = scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const criterionDivergence: Record<string, number> = {};
  for (const criterion of scoringCriteria) {
    const values = buyerRatings
      .filter(rating => rating.criterionId === criterion.id)
      .map(rating => (rating.value / criterion.scaleMax) * 100);
    criterionDivergence[criterion.id] = values.length > 1 ? round(Math.max(...values) - Math.min(...values)) : 0;
  }
  const divergence = scores.length > 1 && compositeScore !== null
    ? round(scores.reduce((sum, score) => sum + Math.abs(score - compositeScore), 0) / scores.length)
    : 0;
  const maxDivergence = scores.length > 1 ? round(Math.max(...scores) - Math.min(...scores)) : 0;
  const vetoes = buyerRatings
    .filter(rating => rating.dealbreakerTriggered && criterionById.get(rating.criterionId)?.isDealbreaker)
    .map(rating => {
      const criterion = criterionById.get(rating.criterionId)!;
      const buyer = buyers.find(item => item.userId === rating.userId)!;
      return { criterionId: criterion.id, label: criterion.label, userId: buyer.userId, userName: buyer.userName };
    });

  return {
    compositeScore,
    divergence,
    maxDivergence,
    hasVeto: vetoes.length > 0,
    vetoes,
    blind: false,
    revealed: true,
    raterScores,
    criterionDivergence,
  };
}