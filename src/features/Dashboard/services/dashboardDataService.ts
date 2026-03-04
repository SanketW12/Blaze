import { firebaseDataService } from '@/firebase';
import type { SuggestedMealItem } from '../types/dashboard';

interface DashboardBootstrapData {
  userProfile: {
    id: string;
    user_id: string;
    name: string | null;
    age: number | null;
    gender: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    activity_level: string | null;
    bmi: number | null;
    bmr: number | null;
    maintenanceCalories: { min?: number; max?: number; unit?: string; label?: string } | null;
    required_nutrients: Record<string, number>;
    must_complete_keys?: string[];
    created_at: string;
    updated_at: string;
  } | null;
  dailyLog: {
    id: string;
    user_id: string;
    log_date: string;
    consumed_nutrients: Record<string, number>;
    suggested_meals: SuggestedMealItem[];
    completion_score: number;
    notes: string | null;
    nutrient_snapshot: Record<string, never>;
    created_at: string;
    updated_at: string;
  } | null;
  meals: Array<{
    id: string;
    user_id: string;
    daily_log_id: string | null;
    food_name: string;
    nutrient_snapshot: Record<string, number>;
    quantity: number;
    unit: string;
    source: 'text' | 'image' | 'manual';
    logged_at: string;
    created_at: string;
  }>;
}

export const loadDashboardBootstrapData = async (today: string): Promise<DashboardBootstrapData> => {
  const [profile, todayLog] = await Promise.all([
    firebaseDataService.getUserProfile(),
    firebaseDataService.getDailyLog(today)
  ]);

  const dailyLogData = todayLog;
  const mealsForActiveDate = dailyLogData ? await firebaseDataService.listMealsForDate(today) : [];

  const mappedProfile = profile
    ? (() => {
      const rawData = profile as unknown as Record<string, unknown>;
      return {
        id: 'profile',
        user_id: 'sanket',
        name: (rawData.name as string | null) ?? null,
        age: (rawData.age as number | null) ?? null,
        gender: (rawData.gender as string | null) ?? null,
        weight_kg:
          (rawData.weightKg as number | null) ??
          (rawData.weight_kg as number | null) ??
          null,
        height_cm:
          (rawData.heightCm as number | null) ??
          (rawData.height_cm as number | null) ??
          null,
        activity_level:
          (rawData.activityLevel as string | null) ??
          (rawData.activity_level as string | null) ??
          null,
        bmi: (rawData.bmi as number | null) ?? null,
        bmr: (rawData.bmr as number | null) ?? null,
        maintenanceCalories:
          (rawData.maintenanceCalories as
            | { min?: number; max?: number; unit?: string; label?: string }
            | undefined) ?? null,
        required_nutrients:
          (rawData.requiredNutrients as Record<string, number> | undefined) ??
          (rawData.required_nutrients as Record<string, number> | undefined) ??
          {},
        must_complete_keys:
          (rawData.mustCompleteKeys as string[] | undefined) ??
          (rawData.must_complete_keys as string[] | undefined) ??
          undefined,
        created_at: '',
        updated_at: new Date().toISOString()
      };
    })()
    : null;

  const mappedDailyLog = dailyLogData
    ? (() => {
      const rawData = dailyLogData as unknown as Record<string, unknown>;
      return {
        id: today,
        user_id: 'sanket',
        log_date: (rawData.date as string | undefined) ?? today,
        consumed_nutrients:
          (rawData.consumedNutrients as Record<string, number> | undefined) ??
          (rawData.consumed_nutrients as Record<string, number> | undefined) ??
          {},
        suggested_meals:
          (rawData.suggestedMeals as SuggestedMealItem[] | undefined) ??
          (rawData.suggested_meals as SuggestedMealItem[] | undefined) ??
          [],
        completion_score: 0,
        notes: (rawData.notes as string | null | undefined) ?? null,
        nutrient_snapshot: {},
        created_at: '',
        updated_at: new Date().toISOString()
      };
    })()
    : null;

  const mappedMeals = mealsForActiveDate.map(meal => ({
    id: meal.id,
    user_id: 'sanket',
    daily_log_id: ((dailyLogData as Record<string, unknown> | null)?.id as string | null) ?? null,
    food_name: meal.name,
    nutrient_snapshot: meal.nutrientSnapshot,
    quantity: meal.quantity,
    unit: meal.unit,
    source: meal.source,
    logged_at: meal.loggedAt,
    created_at: typeof meal.createdAt === 'string' ? meal.createdAt : new Date().toISOString()
  }));

  return {
    userProfile: mappedProfile,
    dailyLog: mappedDailyLog,
    meals: mappedMeals
  };
};
