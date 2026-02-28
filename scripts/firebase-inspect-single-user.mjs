import { initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
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

const summarizeNutrients = nutrients => {
  if (!nutrients || typeof nutrients !== 'object') return {};
  return Object.fromEntries(
    Object.entries(nutrients)
      .filter(([, value]) => Number(value) !== 0)
      .slice(0, 8)
  );
};

const main = async () => {
  const profileSnap = await getDoc(doc(db, 'sanket', 'profile'));
  console.log('sanket/profile exists:', profileSnap.exists());
  if (profileSnap.exists()) {
    const profile = profileSnap.data();
    console.log(
      'requiredNutrients sample:',
      summarizeNutrients(profile.requiredNutrients)
    );
  }

  const mealsSnap = await getDocs(collection(db, 'meals'));
  console.log('meals count:', mealsSnap.size);
  mealsSnap.docs.slice(0, 3).forEach(meal => {
    const data = meal.data();
    console.log('meal:', meal.id, data.name, data.logDate, data.quantity, data.unit);
    console.log('  nutrients sample:', summarizeNutrients(data.nutrientSnapshot));
  });

  const logsSnap = await getDocs(collection(db, 'daily-log'));
  console.log('daily-log count:', logsSnap.size);
  logsSnap.docs.slice(0, 5).forEach(log => {
    const data = log.data();
    console.log('daily-log:', log.id, 'mealCount=', data.mealCount ?? 0);
    console.log('  consumed sample:', summarizeNutrients(data.consumedNutrients));
  });
};

await main();
