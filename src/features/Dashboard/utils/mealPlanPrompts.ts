import type { SuggestedMealItem } from '../types/dashboard';

export const buildSuggestedMealsContext = ({
  nutrientKeys,
  requiredNutrients,
  consumedNutrients,
  mustCompleteKeys,
  aminoAcidKeys,
  generationMode
}: {
  nutrientKeys: string[];
  requiredNutrients: Record<string, number>;
  consumedNutrients: Record<string, number>;
  mustCompleteKeys: string[];
  aminoAcidKeys: string[];
  generationMode: 'full' | 'remaining';
}) => {
  const remainingNutrients = Object.fromEntries(
    nutrientKeys.map(key => {
      const required = Number(requiredNutrients[key] ?? 0);
      const consumed = Number(consumedNutrients[key] ?? 0);
      return [key, Math.max(required - consumed, 0)];
    })
  );
  const remainingKeys = nutrientKeys.filter(key => Number(remainingNutrients[key] ?? 0) > 0);
  const remainingCalories = Number(remainingNutrients.calories ?? 0);
  const remainingTopUpMealCount = remainingCalories <= 450 ? 1 : 2;
  const coveragePriorityRule =
    generationMode === 'remaining'
      ? '- Prioritize must_complete_keys first, then improve coverage for all other remaining nutrient keys without creating a full-day schedule.'
      : '- Prioritize must_complete_keys first, then improve coverage for all other nutrient keys while distributing meals through the day.';

  const suggestedMealsSchema = [
    {
      name: 'string',
      description: 'string',
      contains: [{ item: 'string', quantity: 'string' }],
      timetoConsume: 'string',
      nutrientSnapshot: Object.fromEntries(nutrientKeys.map(key => [key, 0])),
      isConsumed: false
    }
  ];

  return `You are in SUGGESTED MEAL PLAN MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema:
${JSON.stringify(suggestedMealsSchema, null, 2)}
User required_nutrients target:
${JSON.stringify(requiredNutrients, null, 2)}
Already consumed nutrients today:
${JSON.stringify(consumedNutrients, null, 2)}
Remaining nutrients to complete today:
${JSON.stringify(remainingNutrients, null, 2)}
User must_complete_keys priority:
${JSON.stringify(mustCompleteKeys, null, 2)}
Amino acid keys:
${JSON.stringify(aminoAcidKeys, null, 2)}
Generation mode:
${generationMode}
Rules:
- Return an array of suggested meals.
- JSON must be parseable.
- Each nutrientSnapshot value must be a number.
- nutrientSnapshot must include exactly these keys (no extras, no missing): ${nutrientKeys.join(', ')}.
- Plan should target completion of remaining_nutrients across ALL nutrient keys, not just a subset.
- Sum of all meals in this plan should reach at least 95% of each remaining must_complete_key target.
- Sum of all meals in this plan should reach at least 80% of each remaining nutrient key target when remaining target is greater than 0.
- ${coveragePriorityRule}
- If generation mode is "full": return a practical full-day plan.
- If generation mode is "remaining": do NOT return a full-day schedule; return only additional top-up meals needed for remaining_nutrients.
- If generation mode is "remaining": focus only on these remaining nutrient keys: ${remainingKeys.join(', ') || 'none'}.
- If generation mode is "remaining": return exactly ${remainingTopUpMealCount} top-up meal${remainingTopUpMealCount > 1 ? 's' : ''}.
- isConsumed must be boolean.
- Keep meal names practical and real foods.
- description must clearly explain what the meal is and what it contains (key ingredients / preparation style) in 1-2 short lines.
- contains must be an array of objects: [{ item, quantity }].
- Each contains item must include a clear ingredient name in item and serving amount in quantity (example: "200gm", "2 slices", "350ml").`;
};

export const buildReplaceMealContext = ({
  nutrientKeys,
  requiredNutrients,
  mustCompleteKeys,
  mealToReplace,
  replaceInstruction
}: {
  nutrientKeys: string[];
  requiredNutrients: Record<string, number>;
  mustCompleteKeys: string[];
  mealToReplace: SuggestedMealItem;
  replaceInstruction: string;
}) => {
  const replacementSchema = {
    name: 'string',
    description: 'string',
    contains: [{ item: 'string', quantity: 'string' }],
    timetoConsume: mealToReplace.timetoConsume,
    nutrientSnapshot: Object.fromEntries(nutrientKeys.map(key => [key, 0])),
    isConsumed: false
  };

  return `You are in REPLACE MEAL MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema:
${JSON.stringify(replacementSchema, null, 2)}
Meal being replaced:
${JSON.stringify(mealToReplace, null, 2)}
User required_nutrients target:
${JSON.stringify(requiredNutrients, null, 2)}
User must_complete_keys priority:
${JSON.stringify(mustCompleteKeys, null, 2)}
Replace instruction:
${replaceInstruction || 'No additional instruction'}
Rules:
- Keep timetoConsume exactly as "${mealToReplace.timetoConsume}".
- Return one replacement meal object only.
- nutrientSnapshot values must be numbers.
- nutrientSnapshot must include exactly these keys (no extras, no missing): ${nutrientKeys.join(', ')}.
- Prefer better fit toward required_nutrients and must_complete_keys than the replaced meal.
- isConsumed must be false.
- description must clearly explain what the replacement meal is and what it contains (main ingredients / preparation style) in 1-2 short lines.
- contains must be an array of objects: [{ item, quantity }].
- Each contains item must include a clear ingredient name in item and serving amount in quantity (example: "200gm", "2 slices", "350ml").`;
};
