import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
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

const zeroNutrients = () => {
  return nutrientKeys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
};

const toNumber = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeNutrients = input => {
  const base = zeroNutrients();
  if (!input || typeof input !== 'object') return base;

  for (const key of nutrientKeys) {
    base[key] = toNumber(input[key]);
  }
  return base;
};

const normalizeDate = value => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
};

const normalizeIsoDateTime = value => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
};

const upsertMeal = async (mealId, meal) => {
  await setDoc(
    doc(db, 'meals', mealId),
    {
      ...meal,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
};

const addMap = (a, b) => {
  const next = zeroNutrients();
  for (const key of nutrientKeys) {
    next[key] = (a[key] ?? 0) + (b[key] ?? 0);
  }
  return next;
};

const main = async () => {
  console.log('Starting Firestore migration...');

  const mealsByDate = new Map();

  const mergeMealIntoDate = (logDate, mealNutrients) => {
    const current = mealsByDate.get(logDate) ?? {
      consumedNutrients: zeroNutrients(),
      mealCount: 0
    };
    current.consumedNutrients = addMap(current.consumedNutrients, mealNutrients);
    current.mealCount += 1;
    mealsByDate.set(logDate, current);
  };

  const sourceMealCollections = [
    collection(db, 'meals'),
    collection(db, 'app', 'userProfile', 'meals')
  ];

  for (const mealsCol of sourceMealCollections) {
    const snapshot = await getDocs(mealsCol);
    console.log(`Meals read from ${mealsCol.path}: ${snapshot.size}`);

    for (const mealDoc of snapshot.docs) {
      const data = mealDoc.data();
      const nested = data.data ?? {};

      const nutrientSnapshot = normalizeNutrients(
        data.nutrientSnapshot ?? data.nutrients ?? nested.nutrients
      );

      const logDate = normalizeDate(data.logDate ?? nested.logDate ?? nested.logTime);
      const loggedAt = normalizeIsoDateTime(data.loggedAt ?? nested.logTime);

      const normalizedMeal = {
        name: data.name ?? nested.name ?? 'meal',
        quantity: toNumber(data.quantity ?? nested.quantity) || 1,
        unit: data.unit ?? nested.unit ?? 'serving',
        source: data.source ?? nested.source ?? 'manual',
        logDate,
        loggedAt,
        nutrientSnapshot
      };

      await upsertMeal(mealDoc.id, normalizedMeal);
      mergeMealIntoDate(logDate, nutrientSnapshot);
    }
  }

  const dailyCollections = [
    collection(db, 'daily-log'),
    collection(db, 'dailyLogs'),
    collection(db, 'app', 'userProfile', 'dailyLogs')
  ];

  for (const dailyCol of dailyCollections) {
    const snapshot = await getDocs(dailyCol);
    console.log(`Daily logs read from ${dailyCol.path}: ${snapshot.size}`);

    for (const dailyDoc of snapshot.docs) {
      const data = dailyDoc.data();
      const date = normalizeDate(data.date ?? dailyDoc.id);
      const normalized = normalizeNutrients(data.consumedNutrients ?? data.nutrients);
      const current = mealsByDate.get(date) ?? {
        consumedNutrients: zeroNutrients(),
        mealCount: 0
      };

      current.consumedNutrients = addMap(current.consumedNutrients, normalized);
      current.mealCount = Math.max(
        current.mealCount,
        toNumber(data.mealCount ?? data.count ?? 0)
      );
      mealsByDate.set(date, current);
    }
  }

  const profileCandidates = [
    doc(db, 'sanket', 'profile'),
    doc(db, 'app', 'userProfile')
  ];

  let baseProfile = null;
  for (const profileRef of profileCandidates) {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      baseProfile = profileSnap.data();
      break;
    }
  }

  await setDoc(
    doc(db, 'sanket', 'profile'),
    {
      age: baseProfile?.age ?? null,
      weightKg: baseProfile?.weightKg ?? null,
      heightCm: baseProfile?.heightCm ?? null,
      activityLevel: baseProfile?.activityLevel ?? null,
      bmi: baseProfile?.bmi ?? null,
      bmr: baseProfile?.bmr ?? null,
      requiredNutrients: normalizeNutrients(
        baseProfile?.requiredNutrients ?? baseProfile?.required_nutrients
      ),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  for (const [date, totals] of mealsByDate.entries()) {
    await setDoc(
      doc(db, 'daily-log', date),
      {
        date,
        consumedNutrients: totals.consumedNutrients,
        mealCount: totals.mealCount,
        notes: '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  console.log(`Migration complete. Daily logs updated: ${mealsByDate.size}`);
};

await main();
