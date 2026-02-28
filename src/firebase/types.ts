import type { NutrientAmountMap } from './nutrients';

export interface UserProfileDoc {
  age: number | null;
  weightKg: number | null;
  weight_kg?: number | null;
  heightCm: number | null;
  height_cm?: number | null;
  activityLevel: string | null;
  activity_level?: string | null;
  bmi: number | null;
  bmr: number | null;
  requiredNutrients: NutrientAmountMap;
  required_nutrients?: NutrientAmountMap;
  updatedAt?: unknown;
}

export interface DailyLogDoc {
  date: string;
  consumedNutrients: NutrientAmountMap;
  consumed_nutrients?: NutrientAmountMap;
  mealCount?: number;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MealDoc {
  name: string;
  quantity: number;
  unit: string;
  source: 'manual' | 'text' | 'image';
  logDate: string;
  loggedAt: string;
  nutrientSnapshot: NutrientAmountMap;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AddMealInput {
  name: string;
  quantity: number;
  unit: string;
  source: 'manual' | 'text' | 'image';
  logDate: string;
  nutrientSnapshot: NutrientAmountMap;
}
