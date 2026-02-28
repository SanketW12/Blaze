import { initializeApp } from 'firebase/app';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import nutrientsConfig from '../src/config/nutrients.json' with { type: 'json' };
import { collection, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const nutrientKeys = nutrientsConfig.nutrients.map(nutrient => nutrient.key);

const zeroNutrients = () =>
  nutrientKeys.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {});

const normalizeMap = (input = {}) => {
  const base = zeroNutrients();
  for (const key of nutrientKeys) {
    const value = input[key];
    base[key] = Number.isFinite(value) ? Number(value) : 0;
  }
  return base;
};

const addMaps = (a, b) => {
  const next = zeroNutrients();
  for (const key of nutrientKeys) {
    next[key] = Number(a[key] ?? 0) + Number(b[key] ?? 0);
  }
  return next;
};

const now = new Date();
const logDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
  2,
  '0'
)}-${String(now.getDate()).padStart(2, '0')}`;

const appleSnapshot = normalizeMap({
  calories: 95,
  carbohydrates: 25,
  fiber: 4.4,
  protein: 0.5,
  fat: 0.3,
  vitamin_c: 8,
  vitamin_a: 5,
  vitamin_e: 0.3,
  vitamin_k: 4,
  vitamin_b1: 0.03,
  vitamin_b2: 0.02,
  vitamin_b6: 0.07,
  folate: 5,
  potassium: 195,
  calcium: 10,
  magnesium: 9,
  phosphorus: 20,
  iron: 0.2
});

const mealsCollectionRef = collection(db, 'meals');
const mealRef = doc(mealsCollectionRef);
const dailyLogRef = doc(db, 'daily-log', logDate);

await runTransaction(db, async transaction => {
  const dailySnapshot = await transaction.get(dailyLogRef);
  const currentNutrients = dailySnapshot.exists()
    ? normalizeMap(dailySnapshot.data().consumedNutrients ?? {})
    : zeroNutrients();
  const currentMealCount = dailySnapshot.exists()
    ? Number(dailySnapshot.data().mealCount ?? 0)
    : 0;

  transaction.set(mealRef, {
    name: 'Apple',
    quantity: 1,
    unit: 'medium (182g)',
    source: 'manual',
    logDate,
    loggedAt: now.toISOString(),
    nutrientSnapshot: appleSnapshot,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (dailySnapshot.exists()) {
    transaction.set(
      dailyLogRef,
      {
        consumedNutrients: addMaps(currentNutrients, appleSnapshot),
        mealCount: currentMealCount + 1,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } else {
    transaction.set(dailyLogRef, {
      date: logDate,
      consumedNutrients: addMaps(currentNutrients, appleSnapshot),
      mealCount: 1,
      notes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
});

console.log('Apple meal added:', mealRef.id, 'for', logDate);
