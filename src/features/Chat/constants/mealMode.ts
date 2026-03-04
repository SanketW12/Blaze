import mealModeResponseSchema from '@/config/meal-mode-response-schema.json';
import { NUTRIENTS_CONFIG } from '@/config/nutrients';
import type { NutrientValueUnit } from '../types/chat';

export const REQUIRED_MEAL_NUTRIENT_KEYS = Object.keys(mealModeResponseSchema.nutrient_snapshot);

export const MEAL_MODE_NUTRIENT_UNITS = Object.fromEntries(
  REQUIRED_MEAL_NUTRIENT_KEYS.map(key => [
    key,
    NUTRIENTS_CONFIG.nutrients.find(nutrient => nutrient.key === key)?.unit ?? 'mg'
  ])
) as Record<string, NutrientValueUnit>;

export const MEAL_MODE_AMINO_ACID_KEYS = NUTRIENTS_CONFIG.nutrients
  .filter(nutrient => nutrient.category === 'amino_acid')
  .map(nutrient => nutrient.key);

export const AMINO_MG_PER_GRAM_PROTEIN: Partial<Record<string, number>> = {
  histidine: 18,
  isoleucine: 36,
  leucine: 69,
  lysine: 58,
  methionine: 27,
  phenylalanine: 45,
  threonine: 35,
  tryptophan: 11,
  valine: 45
};

export const MEAL_MODE_CONTEXT = `You are in MEAL MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema (MealModeAiResponse):
${JSON.stringify(mealModeResponseSchema, null, 2)}
Nutrient units by key (must be followed exactly):
${JSON.stringify(MEAL_MODE_NUTRIENT_UNITS, null, 2)}
Rules:
- JSON must be parseable.
- nutrient_snapshot values must be numbers.
- nutrient_snapshot must include exactly these keys (no extras, no missing): ${REQUIRED_MEAL_NUTRIENT_KEYS.join(
  ', '
)}.
- Do not skip any nutrient key. Every key above must always be present in nutrient_snapshot.
- If exact nutrient data is unknown, provide a best-effort numeric estimate for that key instead of omitting it.
- Never return null, undefined, empty strings, or non-numeric placeholders for nutrient_snapshot values.
- Use exact units from Nutrient units by key. Do not change unit scale.
- Amino acid keys must be in mg (not g): ${MEAL_MODE_AMINO_ACID_KEYS.join(', ')}.
- Example: if leucine is 2.3g, return 2300 (mg) in nutrient_snapshot.leucine.
- source must be one of: text, image, manual.
- Focus only on meal nutrition responses.`;
