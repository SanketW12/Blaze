export type NutrientUnit = 'g' | 'mg' | 'mcg' | 'ml' | 'kcal';

export interface NutrientDefinition {
  key: string;
  label: string;
  unit: NutrientUnit;
  category: string;
  defaultDaily?: number;
}

export interface NutrientProgressItem {
  definition: NutrientDefinition;
  target: number;
  consumed: number;
  remaining: number;
  completionPercent: number;
}

export interface SuggestedMealContainItem {
  item: string;
  quantity: string;
}

export interface SuggestedMealItem {
  name: string;
  description: string;
  contains: SuggestedMealContainItem[];
  timetoConsume: string;
  nutrientSnapshot: Record<string, number>;
  isConsumed: boolean;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
