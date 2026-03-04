import type { NutrientValueUnit } from '../types/chat';

export const convertBetweenMassUnits = (
  value: number,
  fromUnit: Extract<NutrientValueUnit, 'g' | 'mg' | 'mcg'>,
  toUnit: Extract<NutrientValueUnit, 'g' | 'mg' | 'mcg'>
) => {
  if (fromUnit === toUnit) return value;
  const inMg = fromUnit === 'g' ? value * 1000 : fromUnit === 'mcg' ? value / 1000 : value;
  if (toUnit === 'g') return inMg / 1000;
  if (toUnit === 'mcg') return inMg * 1000;
  return inMg;
};

export const parseNutrientValue = (rawValue: unknown, expectedUnit: NutrientValueUnit): number => {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : 0;
  }

  if (typeof rawValue !== 'string') return 0;
  const normalized = rawValue.trim().toLowerCase().replaceAll(',', '');
  if (!normalized) return 0;

  const matched = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(kcal|g|mg|mcg|ml)?$/i);
  if (!matched) return 0;
  const numeric = Number(matched[1]);
  if (!Number.isFinite(numeric)) return 0;
  const providedUnit = (matched[2]?.toLowerCase() as NutrientValueUnit | undefined) ?? expectedUnit;

  if (providedUnit === expectedUnit) return numeric;
  if (
    (providedUnit === 'g' || providedUnit === 'mg' || providedUnit === 'mcg') &&
    (expectedUnit === 'g' || expectedUnit === 'mg' || expectedUnit === 'mcg')
  ) {
    return convertBetweenMassUnits(numeric, providedUnit, expectedUnit);
  }

  return numeric;
};
