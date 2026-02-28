type NutrientAmountMap = Record<string, number>;

export const DASHBOARD_USE_MOCK_DATA = false;

export const DASHBOARD_MOCK_CONSUMED_NUTRIENTS: NutrientAmountMap = {
  calories: 1680,
  protein: 82,
  carbohydrates: 210,
  fat: 58,
  fiber: 24,
  water: 2200,
  leucine: 2900,
  lysine: 2200,
  omega3: 1950,
  omega6: 12000,
  vitamin_a: 780,
  vitamin_c: 112,
  vitamin_d: 34,
  vitamin_b12: 4.5,
  magnesium: 305,
  potassium: 2760,
  iron: 7.2,
  zinc: 12.4
};

export const DASHBOARD_MOCK_REQUIRED_NUTRIENTS: NutrientAmountMap = {
  calories: 2200,
  protein: 120,
  carbohydrates: 275,
  fat: 75,
  fiber: 35,
  water: 3200,
  leucine: 3120,
  lysine: 2400,
  omega3: 1800,
  omega6: 17000,
  vitamin_a: 900,
  vitamin_c: 100,
  vitamin_d: 50,
  vitamin_b12: 4,
  magnesium: 420,
  potassium: 3400,
  iron: 9,
  zinc: 12
};
