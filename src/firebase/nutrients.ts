import { NUTRIENTS_CONFIG } from '@/config';

export type NutrientAmountMap = Record<string, number>;

export const ALL_NUTRIENT_KEYS = NUTRIENTS_CONFIG.nutrients.map(
  nutrient => nutrient.key
);

export const createZeroNutrientMap = (): NutrientAmountMap => {
  return ALL_NUTRIENT_KEYS.reduce<NutrientAmountMap>((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {});
};

export const normalizeNutrientMap = (
  input: NutrientAmountMap | undefined
): NutrientAmountMap => {
  const base = createZeroNutrientMap();

  if (!input) return base;

  for (const key of ALL_NUTRIENT_KEYS) {
    const value = input[key];
    base[key] = Number.isFinite(value) ? Number(value) : 0;
  }

  return base;
};

export const addNutrientMaps = (
  a: NutrientAmountMap,
  b: NutrientAmountMap
): NutrientAmountMap => {
  const next = createZeroNutrientMap();

  for (const key of ALL_NUTRIENT_KEYS) {
    next[key] = (a[key] ?? 0) + (b[key] ?? 0);
  }

  return next;
};
