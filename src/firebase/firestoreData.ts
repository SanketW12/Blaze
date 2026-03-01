import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { db } from './client';
import {
  addNutrientMaps,
  createZeroNutrientMap,
  normalizeNutrientMap
} from './nutrients';
import type {
  AddMealInput,
  DailyLogDoc,
  MealDoc,
  SuggestedMealDoc,
  UserProfileDoc
} from './types';

const USER_PROFILE_REF = doc(db, 'sanket', 'profile');
const dailyLogDocRef = (date: string) => doc(db, 'daily-log', date);
const mealsCollectionRef = () => collection(db, 'meals');

export const firebaseDataService = {
  async getUserProfile() {
    const snapshot = await getDoc(USER_PROFILE_REF);
    if (!snapshot.exists()) return null;
    return snapshot.data() as UserProfileDoc;
  },

  async upsertUserProfile(profile: Partial<UserProfileDoc>) {
    await setDoc(
      USER_PROFILE_REF,
      {
        ...profile,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  },

  async getDailyLog(date: string) {
    const snapshot = await getDoc(dailyLogDocRef(date));
    if (!snapshot.exists()) return null;
    return snapshot.data() as DailyLogDoc;
  },

  async getLatestDailyLog() {
    const latestQuery = query(
      collection(db, 'daily-log'),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(latestQuery);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as DailyLogDoc;
  },

  async listMealsForDate(date: string) {
    const mealsQuery = query(mealsCollectionRef(), where('logDate', '==', date));
    const snapshot = await getDocs(mealsQuery);
    return snapshot.docs
      .map(mealDoc => ({
        id: mealDoc.id,
        ...(mealDoc.data() as MealDoc)
      }))
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  },

  async addMealAndUpdateDailyLog(input: AddMealInput) {
    const mealRef = doc(mealsCollectionRef());
    const logRef = dailyLogDocRef(input.logDate);

    await runTransaction(db, async transaction => {
      const dailySnapshot = await transaction.get(logRef);
      const mealNutrients = normalizeNutrientMap(input.nutrientSnapshot);

      const baseNutrients = dailySnapshot.exists()
        ? normalizeNutrientMap(
            (dailySnapshot.data() as DailyLogDoc).consumedNutrients
          )
        : createZeroNutrientMap();

      const nextNutrients = addNutrientMaps(baseNutrients, mealNutrients);
      const currentMealCount = dailySnapshot.exists()
        ? Number((dailySnapshot.data() as DailyLogDoc).mealCount ?? 0)
        : 0;

      transaction.set(mealRef, {
        ...input,
        nutrientSnapshot: mealNutrients,
        loggedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (dailySnapshot.exists()) {
        transaction.set(
          logRef,
          {
            consumedNutrients: nextNutrients,
            mealCount: currentMealCount + 1,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } else {
        transaction.set(logRef, {
          date: input.logDate,
          consumedNutrients: nextNutrients,
          mealCount: 1,
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    });

    return mealRef.id;
  },

  async upsertSuggestedMealsForDate(
    logDate: string,
    suggestedMeals: SuggestedMealDoc[]
  ) {
    const logRef = dailyLogDocRef(logDate);
    await runTransaction(db, async transaction => {
      const dailySnapshot = await transaction.get(logRef);

      if (dailySnapshot.exists()) {
        transaction.set(
          logRef,
          {
            suggestedMeals,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        return;
      }

      transaction.set(logRef, {
        date: logDate,
        consumedNutrients: createZeroNutrientMap(),
        mealCount: 0,
        notes: '',
        suggestedMeals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
  }
};
