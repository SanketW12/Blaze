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

const nutrientKeys = nutrientsConfig.nutrients.map(n => n.key);

const zeroMap = () =>
  nutrientKeys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

const addMap = (a, b) => {
  const next = zeroMap();
  for (const key of nutrientKeys) {
    next[key] = Number(a[key] ?? 0) + Number(b[key] ?? 0);
  }
  return next;
};

// Approx nutrition for 1 large boiled egg (~50g)
const eggSnapshot = {
  ...zeroMap(),
  calories: 78,
  protein: 6.3,
  fat: 5.3,
  carbohydrates: 0.6,
  fiber: 0,
  water: 38,
  omega3: 37,
  omega6: 830,
  leucine: 540,
  lysine: 450,
  methionine: 190,
  threonine: 300,
  valine: 430,
  tryptophan: 80,
  vitamin_a: 80,
  vitamin_d: 1.1,
  vitamin_b12: 0.6,
  vitamin_b2: 0.25,
  vitamin_b5: 0.7,
  vitamin_b6: 0.06,
  folate: 24,
  biotin: 10,
  vitamin_e: 0.5,
  vitamin_k: 0.3,
  selenium: 15.4,
  zinc: 0.6,
  iron: 0.9,
  phosphorus: 95,
  iodine: 24,
  sodium: 62,
  potassium: 63,
  calcium: 28,
  magnesium: 6
};

const main = async () => {
  const mealsSnap = await getDocs(collection(db, 'meals'));
  const eggMeals = mealsSnap.docs.filter(mealDoc => {
    const meal = mealDoc.data();
    return String(meal.name ?? '').trim().toLowerCase() === 'egg';
  });

  if (eggMeals.length === 0) {
    console.log('No egg meal found.');
    return;
  }

  const affectedDates = new Set();

  for (const mealDoc of eggMeals) {
    const meal = mealDoc.data();
    const logDate =
      typeof meal.logDate === 'string'
        ? meal.logDate
        : new Date().toISOString().slice(0, 10);
    affectedDates.add(logDate);

    await setDoc(
      doc(db, 'meals', mealDoc.id),
      {
        nutrientSnapshot: eggSnapshot,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  for (const logDate of affectedDates) {
    const refreshedMeals = await getDocs(collection(db, 'meals'));
    const mealsForDate = refreshedMeals.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(meal => meal.logDate === logDate);

    const dailyTotals = mealsForDate.reduce((acc, meal) => {
      return addMap(acc, meal.nutrientSnapshot ?? {});
    }, zeroMap());

    await setDoc(
      doc(db, 'daily-log', logDate),
      {
        date: logDate,
        consumedNutrients: dailyTotals,
        mealCount: mealsForDate.length,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  console.log(`Updated egg meals: ${eggMeals.length}`);
  console.log(`Updated daily logs: ${affectedDates.size}`);
};

await main();
