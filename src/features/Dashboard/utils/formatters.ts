import type { NutrientDefinition, SuggestedMealContainItem } from '../types/dashboard';

export const formatAmount = (value: number, unit: NutrientDefinition['unit']) => {
  if (!Number.isFinite(value) || value <= 0) return `0${unit}`;

  if (unit === 'g') {
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')}${unit}`;
  }

  if (unit === 'ml' || unit === 'mg' || unit === 'kcal') {
    return `${value.toFixed(0)}${unit}`;
  }

  return `${value.toFixed(1).replace(/\.0$/, '')}${unit}`;
};

export const formatConsumedVsTarget = (
  consumed: number,
  target: number,
  unit: NutrientDefinition['unit']
) => {
  if (target <= 0) return `${formatAmount(consumed, unit)}/--`;

  const consumedValue = formatAmount(consumed, unit).replace(unit, '');
  const targetValue = formatAmount(target, unit).replace(unit, '');
  return `${consumedValue}/${targetValue} ${unit}`;
};

export const formatProfileValue = (value: unknown, suffix = '') => {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}${suffix}`;
  }
  if (typeof value === 'string') {
    return suffix ? `${value}${suffix}` : value;
  }
  return 'Not set';
};

export const normalizeMealContains = (
  contains: unknown,
  legacyQuantity?: unknown
): SuggestedMealContainItem[] => {
  if (Array.isArray(contains)) {
    return contains
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const rawEntry = entry as Record<string, unknown>;
        const item = typeof rawEntry.item === 'string' ? rawEntry.item.trim() : '';
        const quantity = typeof rawEntry.quantity === 'string' ? rawEntry.quantity.trim() : '';
        if (!item || !quantity) return null;
        return { item, quantity };
      })
      .filter((entry): entry is SuggestedMealContainItem => Boolean(entry));
  }

  if (typeof contains === 'string' && contains.trim()) {
    const quantity =
      typeof legacyQuantity === 'string' && legacyQuantity.trim() ? legacyQuantity.trim() : 'NA';
    return [{ item: contains.trim(), quantity }];
  }

  return [];
};
