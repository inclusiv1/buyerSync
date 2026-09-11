export type PropertyAssessment = {
  key: string;
  label: string;
  status: 'met' | 'gap' | 'unknown';
  met: boolean;
  actual: number | string | null;
  target: number | string;
  message: string;
};

type NumericRequirement = {
  key: string;
  propertyKey: string;
  label: string;
  direction: 'min' | 'max';
  unit?: string;
};

const numericRequirements: NumericRequirement[] = [
  { key: 'minPrice', propertyKey: 'price', label: 'Minimum price', direction: 'min', unit: '$' },
  { key: 'maxPrice', propertyKey: 'price', label: 'Maximum price', direction: 'max', unit: '$' },
  { key: 'minBeds', propertyKey: 'beds', label: 'Bedrooms', direction: 'min' },
  { key: 'minBaths', propertyKey: 'baths', label: 'Bathrooms', direction: 'min' },
  { key: 'minSqft', propertyKey: 'sqft', label: 'Square footage', direction: 'min', unit: ' sq ft' },
  { key: 'yearBuiltMin', propertyKey: 'yearBuilt', label: 'Year built', direction: 'min' },
  { key: 'yearBuiltMax', propertyKey: 'yearBuilt', label: 'Year built', direction: 'max' },
  { key: 'lotSizeMin', propertyKey: 'lotSize', label: 'Lot size', direction: 'min', unit: ' acres' },
  { key: 'hoaMax', propertyKey: 'hoa', label: 'Monthly HOA', direction: 'max', unit: '$' },
];

const formatValue = (value: number, unit = '') => unit === '$' ? `$${value.toLocaleString()}` : `${value.toLocaleString()}${unit}`;

export function calculateScore(items: any[], userWeights: any[], itemStatuses: any[], criteria?: any, property?: any) {
  let totalWeight = 0;
  let weightedMet = 0;
  let mustHaveGaps = 0;
  const assessments: PropertyAssessment[] = [];

  if (criteria && property) {
    numericRequirements.forEach(requirement => {
      const rawTarget = criteria[requirement.key];
      if (rawTarget === null || rawTarget === undefined || rawTarget === '') return;
      const target = Number(rawTarget);
      if (!Number.isFinite(target)) return;
      const actual = Number(property[requirement.propertyKey]);
      const hasActual = property[requirement.propertyKey] !== null && property[requirement.propertyKey] !== undefined && Number.isFinite(actual);
      const met = hasActual && (requirement.direction === 'min' ? actual >= target : actual <= target);
      const status = !hasActual ? 'unknown' : met ? 'met' : 'gap';
      const targetText = formatValue(target, requirement.unit);
      const actualText = hasActual ? formatValue(actual, requirement.unit) : 'not listed';
      const comparator = requirement.direction === 'min' ? 'required' : 'maximum';
      const noun = requirement.key === 'minBeds' ? 'bedrooms' : requirement.label.toLowerCase();
      assessments.push({
        key: requirement.key,
        label: requirement.label,
        status,
        met,
        actual: hasActual ? actual : null,
        target,
        message: met
          ? `${actualText} meets the ${targetText} ${comparator}`
          : `${actualText} ${noun}; ${targetText} ${comparator}`,
      });
      if (!met) mustHaveGaps++;
      const normalized = !hasActual
        ? 0
        : requirement.direction === 'min'
          ? Math.min(1, target === 0 ? 1 : actual / target)
          : Math.min(1, actual === 0 ? 1 : target / actual);
      totalWeight += 10;
      weightedMet += normalized * 10;
    });
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

  const score = totalWeight > 0 ? Number(((weightedMet / totalWeight) * 100).toFixed(1)) : 0;
  return { score, mustHaveGaps, assessments, hasCriteria: totalWeight > 0 };
}
