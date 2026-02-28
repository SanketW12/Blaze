import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
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

const dateIdRegex = /^\d{4}-\d{2}-\d{2}$/;

const main = async () => {
  const logsSnap = await getDocs(collection(db, 'daily-log'));

  let deleted = 0;
  for (const log of logsSnap.docs) {
    const data = log.data();
    const isDateId = dateIdRegex.test(log.id);
    const hasNutrients =
      data?.consumedNutrients &&
      Object.values(data.consumedNutrients).some(value => Number(value) !== 0);
    const mealCount = Number(data?.mealCount ?? 0);

    if (!isDateId && !hasNutrients && mealCount === 0) {
      await deleteDoc(doc(db, 'daily-log', log.id));
      deleted += 1;
    }
  }

  console.log(`Cleanup complete. Deleted legacy daily-log docs: ${deleted}`);
};

await main();
