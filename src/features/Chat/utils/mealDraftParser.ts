import {
  AMINO_MG_PER_GRAM_PROTEIN,
  MEAL_MODE_AMINO_ACID_KEYS,
  MEAL_MODE_NUTRIENT_UNITS,
  REQUIRED_MEAL_NUTRIENT_KEYS
} from '../constants/mealMode';
import type { MealDraft, MealModeAiResponse } from '../types/chat';
import { parseNutrientValue } from './nutrientUnits';

export const parseMealDraft = (assistantText: string): MealDraft | null => {
  const trimmed = assistantText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = (fencedMatch?.[1] ?? trimmed).trim();
  try {
    const parsedRaw = JSON.parse(jsonCandidate) as Record<string, unknown>;
    if (typeof parsedRaw.food_name !== 'string' || !parsedRaw.food_name.trim()) return null;
    if (typeof parsedRaw.quantity !== 'number' || !Number.isFinite(parsedRaw.quantity)) return null;
    if (typeof parsedRaw.unit !== 'string' || !parsedRaw.unit.trim()) return null;
    const source = parsedRaw.source;
    if (source !== 'text' && source !== 'image' && source !== 'manual') return null;
    const snapshot = parsedRaw.nutrient_snapshot as Record<string, unknown> | undefined;
    if (!snapshot || typeof snapshot !== 'object') return null;
    const snapshotKeys = Object.keys(snapshot);
    const hasAllRequiredKeys = REQUIRED_MEAL_NUTRIENT_KEYS.every(key => snapshotKeys.includes(key));
    const hasOnlyAllowedKeys = snapshotKeys.every(key => REQUIRED_MEAL_NUTRIENT_KEYS.includes(key));
    if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;
    const nutrientSnapshot = Object.fromEntries(
      REQUIRED_MEAL_NUTRIENT_KEYS.map(key => [
        key,
        parseNutrientValue(snapshot[key], MEAL_MODE_NUTRIENT_UNITS[key] ?? 'mg')
      ])
    ) as Record<string, number>;

    const hasAnyAminoValue = MEAL_MODE_AMINO_ACID_KEYS.some(
      key => Number(nutrientSnapshot[key] ?? 0) > 0
    );
    const proteinInGrams = Number(nutrientSnapshot.protein ?? 0);
    if (!hasAnyAminoValue && proteinInGrams > 0) {
      MEAL_MODE_AMINO_ACID_KEYS.forEach(key => {
        const ratio = AMINO_MG_PER_GRAM_PROTEIN[key];
        if (!ratio) return;
        nutrientSnapshot[key] = Math.max(0, Math.round(proteinInGrams * ratio));
      });
    }

    const parsed = {
      id: typeof parsedRaw.id === 'string' ? parsedRaw.id : '',
      user_id: typeof parsedRaw.user_id === 'string' ? parsedRaw.user_id : 'sanket',
      daily_log_id:
        typeof parsedRaw.daily_log_id === 'string' || parsedRaw.daily_log_id === null
          ? parsedRaw.daily_log_id
          : null,
      food_name: parsedRaw.food_name,
      nutrient_snapshot: nutrientSnapshot,
      quantity: parsedRaw.quantity,
      unit: parsedRaw.unit,
      source,
      logged_at: typeof parsedRaw.logged_at === 'string' ? parsedRaw.logged_at : '',
      created_at: typeof parsedRaw.created_at === 'string' ? parsedRaw.created_at : ''
    } as MealModeAiResponse;
    return {
      food_name: parsed.food_name,
      nutrient_snapshot: parsed.nutrient_snapshot,
      quantity: parsed.quantity,
      unit: parsed.unit,
      source: parsed.source
    };
  } catch {
    return null;
  }
};
