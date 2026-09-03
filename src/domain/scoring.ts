import type { Criterion, DealbreakerResult, ScoreResult, ScoreSubmission } from './models';

const round = (value: number, places = 1) => Number(value.toFixed(places));

export interface ScoringOptions {
  blind?: boolean;
  requiredBuyerRoles?: Array<'primary_buyer' | 'co_buyer'>;
}

export function calculateCollaborativeScore(
  criteria: Criterion[],
  submissions: ScoreSubmission[],
  options: ScoringOptions = {},
): ScoreResult {
  const blind = options.blind ?? false;
  const requiredRoles = options.requiredBuyerRoles ?? ['primary_buyer', 'co_buyer'];
  const submitted = submissions.filter((submission) => submission.isSubmitted);
  const revealed = !blind || requiredRoles.every((role) => submitted.some((submission) => submission.user.role === role));
  const criterionById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const vetoes: DealbreakerResult[] = submitted.flatMap((submission) =>
    submission.dealbreakers
      .filter((rating) => rating.triggered && criterionById.get(rating.criterionId)?.isDealbreaker)
      .map((rating) => ({
        criterionId: rating.criterionId,
        label: criterionById.get(rating.criterionId)?.label ?? 'Dealbreaker',
        userId: submission.user.id,
        userName: submission.user.name,
        note: rating.note,
      })),
  );

  const raterScores = submitted.map((submission) => {
    let weightedTotal = 0;
    let availableWeight = 0;
    submission.scores.forEach((rating) => {
      const criterion = criterionById.get(rating.criterionId);
      if (!criterion || criterion.isDealbreaker || criterion.weight <= 0) return;
      const boundedValue = Math.min(criterion.scaleMax, Math.max(0, rating.value));
      weightedTotal += (boundedValue / criterion.scaleMax) * criterion.weight;
      availableWeight += criterion.weight;
    });
    return {
      userId: submission.user.id,
      userName: submission.user.name,
      role: submission.user.role,
      score: availableWeight ? round((weightedTotal / availableWeight) * 100) : 0,
    };
  });

  const criterionDivergence: Record<string, number> = {};
  criteria.forEach((criterion) => {
    const normalized = submitted.flatMap((submission) => {
      const rating = submission.scores.find((entry) => entry.criterionId === criterion.id);
      return rating ? [(rating.value / criterion.scaleMax) * 100] : [];
    });
    criterionDivergence[criterion.id] = normalized.length > 1 ? round(Math.max(...normalized) - Math.min(...normalized)) : 0;
  });

  const visibleScores = revealed ? raterScores : [];
  const values = raterScores.map((rater) => rater.score);
  const divergence = values.length > 1
    ? round(values.reduce((sum, value) => sum + Math.abs(value - values.reduce((a, b) => a + b, 0) / values.length), 0) / values.length)
    : 0;

  return {
    compositeScore: revealed && values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    divergence,
    maxDivergence: values.length > 1 ? round(Math.max(...values) - Math.min(...values)) : 0,
    hasVeto: vetoes.length > 0,
    vetoes: revealed ? vetoes : [],
    blind,
    revealed,
    raterScores: visibleScores,
    criterionDivergence: revealed ? criterionDivergence : {},
  };
}