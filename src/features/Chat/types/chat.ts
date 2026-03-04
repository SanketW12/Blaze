export type NutrientValueUnit = 'g' | 'mg' | 'mcg' | 'ml' | 'kcal';

export interface MealDraft {
  food_name: string;
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  source: 'text' | 'image' | 'manual';
}

export interface MealModeAiResponse {
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
}

export interface ChatMessageItem {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}
