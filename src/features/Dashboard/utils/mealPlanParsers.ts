import { normalizeMealContains } from './formatters';
import type { SuggestedMealItem } from '../types/dashboard';

const extractJsonCandidate = (assistantText: string) => {
  const trimmed = assistantText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fencedMatch?.[1] ?? trimmed).trim();
};

export const parseSuggestedMealPlan = (
  assistantText: string,
  nutrientKeys: string[]
): SuggestedMealItem[] | null => {
  const jsonCandidate = extractJsonCandidate(assistantText);

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const normalizedMeals = parsed
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const rawItem = item as Record<string, unknown>;
        if (typeof rawItem.name !== 'string' || !rawItem.name.trim()) return null;
        if (typeof rawItem.description !== 'string' || !rawItem.description.trim()) return null;
        const contains = normalizeMealContains(rawItem.contains);
        if (contains.length === 0) return null;
        if (typeof rawItem.timetoConsume !== 'string' || !rawItem.timetoConsume.trim()) return null;
        if (typeof rawItem.isConsumed !== 'boolean') return null;

        const rawSnapshot = rawItem.nutrientSnapshot as Record<string, unknown> | undefined;
        if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;
        const snapshotKeys = Object.keys(rawSnapshot);
        const hasAllRequiredKeys = nutrientKeys.every(key => snapshotKeys.includes(key));
        const hasOnlyAllowedKeys = snapshotKeys.every(key => nutrientKeys.includes(key));
        if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;

        const nutrientSnapshot = Object.fromEntries(
          nutrientKeys.map(key => [key, Number(rawSnapshot[key]) || 0])
        );

        return {
          name: rawItem.name,
          description: rawItem.description,
          contains,
          timetoConsume: rawItem.timetoConsume,
          nutrientSnapshot,
          isConsumed: rawItem.isConsumed
        } as SuggestedMealItem;
      })
      .filter((item): item is SuggestedMealItem => Boolean(item));

    return normalizedMeals.length > 0 ? normalizedMeals : null;
  } catch {
    return null;
  }
};

export const parseReplacementMeal = (
  assistantText: string,
  nutrientKeys: string[]
): SuggestedMealItem | null => {
  const jsonCandidate = extractJsonCandidate(assistantText);
  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    const candidate = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed;
    if (!candidate || typeof candidate !== 'object') return null;
    const rawItem = candidate as Record<string, unknown>;
    if (typeof rawItem.name !== 'string' || !rawItem.name.trim()) return null;
    if (typeof rawItem.description !== 'string' || !rawItem.description.trim()) return null;
    const contains = normalizeMealContains(rawItem.contains);
    if (contains.length === 0) return null;
    if (typeof rawItem.timetoConsume !== 'string' || !rawItem.timetoConsume.trim()) return null;
    if (typeof rawItem.isConsumed !== 'boolean') return null;

    const rawSnapshot = rawItem.nutrientSnapshot as Record<string, unknown> | undefined;
    if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;
    const snapshotKeys = Object.keys(rawSnapshot);
    const hasAllRequiredKeys = nutrientKeys.every(key => snapshotKeys.includes(key));
    const hasOnlyAllowedKeys = snapshotKeys.every(key => nutrientKeys.includes(key));
    if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;

    const nutrientSnapshot = Object.fromEntries(
      nutrientKeys.map(key => [key, Number(rawSnapshot[key]) || 0])
    );

    return {
      name: rawItem.name,
      description: rawItem.description,
      contains,
      timetoConsume: rawItem.timetoConsume,
      nutrientSnapshot,
      isConsumed: false
    };
  } catch {
    return null;
  }
};
