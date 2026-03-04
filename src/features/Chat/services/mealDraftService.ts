import { addNutrientMaps, firebaseDataService, normalizeNutrientMap } from '@/firebase';
import type { MealDraft } from '../types/chat';
import type { AppStoreState } from '@/store/useAppStore';

type DailyLogState = AppStoreState['dailyLog'];

type AddMealFn = (payload: {
  id: string;
  user_id: string;
  daily_log_id: string;
  food_name: string;
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  source: 'text' | 'image' | 'manual';
  logged_at: string;
  created_at: string;
}) => void;

type SetDailyLogFn = AppStoreState['setDailyLog'];

export const addMealFromDraft = async ({
  mealDraft,
  dailyLog,
  addMeal,
  setDailyLog
}: {
  mealDraft: MealDraft;
  dailyLog: DailyLogState;
  addMeal: AddMealFn;
  setDailyLog: SetDailyLogFn;
}) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const mealId = await firebaseDataService.addMealAndUpdateDailyLog({
    name: mealDraft.food_name,
    quantity: mealDraft.quantity,
    unit: mealDraft.unit,
    source: mealDraft.source,
    logDate: today,
    nutrientSnapshot: mealDraft.nutrient_snapshot
  });

  addMeal({
    id: mealId,
    user_id: 'sanket',
    daily_log_id: dailyLog?.id ?? today,
    food_name: mealDraft.food_name,
    nutrient_snapshot: mealDraft.nutrient_snapshot,
    quantity: mealDraft.quantity,
    unit: mealDraft.unit,
    source: mealDraft.source,
    logged_at: now.toISOString(),
    created_at: now.toISOString()
  });

  const updatedConsumed = addNutrientMaps(
    normalizeNutrientMap(dailyLog?.consumed_nutrients ?? {}),
    normalizeNutrientMap(mealDraft.nutrient_snapshot)
  );
  if (dailyLog) {
    setDailyLog({
      ...dailyLog,
      consumed_nutrients: updatedConsumed,
      updated_at: now.toISOString()
    });
  } else {
    setDailyLog({
      id: today,
      user_id: 'sanket',
      log_date: today,
      consumed_nutrients: updatedConsumed,
      suggested_meals: [],
      completion_score: 0,
      notes: null,
      nutrient_snapshot: {},
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });
  }
};
