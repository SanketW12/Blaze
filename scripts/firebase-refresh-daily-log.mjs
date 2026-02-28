import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import nutrientsConfig from '../src/config/nutrients.json' with { type: 'json' };
import { getFirestore } from 'firebase/firestore';

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

const normalizeMap = input => {
  const base = zeroNutrients();
  if (!input || typeof input !== 'object') return base;

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
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
  2,
  '0'
)}-${String(now.getDate()).padStart(2, '0')}`;

const mealsSnap = await getDocs(collection(db, 'meals'));
const mealsForToday = mealsSnap.docs
  .map(mealDoc => ({ id: mealDoc.id, ...mealDoc.data() }))
  .filter(meal => meal.logDate === today);

const consumedNutrients = mealsForToday.reduce((acc, meal) => {
  return addMaps(acc, normalizeMap(meal.nutrientSnapshot));
}, zeroNutrients());

await setDoc(
  doc(db, 'daily-log', today),
  {
    date: today,
    consumedNutrients,
    mealCount: mealsForToday.length,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  },
  { merge: true }
);

console.log(`Daily log refreshed for ${today}. meals=${mealsForToday.length}`);
console.log({
  calories: consumedNutrients.calories,
  protein: consumedNutrients.protein,
  carbohydrates: consumedNutrients.carbohydrates,
  fiber: consumedNutrients.fiber,
  vitamin_d: consumedNutrients.vitamin_d,
  omega3: consumedNutrients.omega3
});
