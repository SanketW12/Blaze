import nutrientsConfig from './nutrients.json';

interface NutrientDefinition {
  key: string;
  label: string;
  unit: 'g' | 'mg' | 'mcg' | 'ml' | 'kcal';
  category: string;
  defaultDaily?: number;
}

interface NutrientConfig {
  dashboardPriority: string[];
  nutrients: NutrientDefinition[];
}

export const NUTRIENTS_CONFIG = nutrientsConfig as NutrientConfig;
