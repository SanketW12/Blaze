export { db } from './client';
export { firebaseDataService } from './firestoreData';
export type { AddMealInput, DailyLogDoc, MealDoc, UserProfileDoc } from './types';
export {
  ALL_NUTRIENT_KEYS,
  addNutrientMaps,
  createZeroNutrientMap,
  normalizeNutrientMap
} from './nutrients';
