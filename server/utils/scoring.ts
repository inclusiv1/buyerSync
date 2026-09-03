export function calculateScore(items: any[], userWeights: any[], itemStatuses: any[], criteria?: any, property?: any) {
  let totalWeight = 0;
  let weightedMet = 0;
  let mustHaveGaps = 0;

  // Check structured criteria (Price, Beds, Sqft)
  if (criteria && property) {
    if (criteria.minPrice && property.price && property.price < criteria.minPrice) mustHaveGaps++;
    if (criteria.maxPrice && property.price && property.price > criteria.maxPrice) mustHaveGaps++;
    if (criteria.minBeds && property.beds && property.beds < criteria.minBeds) mustHaveGaps++;
    if (criteria.minSqft && property.sqft && property.sqft < criteria.minSqft) mustHaveGaps++;
  }

  items.forEach(item => {
    const weightObj = userWeights.find(w => w.checklistItemId === item.id);
    const weight = weightObj ? weightObj.weight : 0;
    
    const statusObj = itemStatuses.find(s => s.checklistItemId === item.id);
    const isMet = statusObj ? statusObj.isMet : 'unknown';

    let metValue = 0.5;
    if (isMet === 'yes') metValue = 1;
    if (isMet === 'no') {
      metValue = 0;
      if (item.category === 'must-have') mustHaveGaps++;
    }
    if (isMet === 'unknown' && item.category === 'must-have') {
      mustHaveGaps++;
    }

    if (weight > 0) {
      totalWeight += weight;
      weightedMet += weight * metValue;
    }
  });

  const score = totalWeight > 0 ? (weightedMet / totalWeight) * 100 : 0;
  return { score, mustHaveGaps };
}
