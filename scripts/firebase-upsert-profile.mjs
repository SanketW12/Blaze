import { initializeApp } from 'firebase/app';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import nutrientsConfig from '../src/config/nutrients.json' with { type: 'json' };

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

const requiredNutrients = nutrientsConfig.nutrients.reduce((accumulator, nutrient) => {
  accumulator[nutrient.key] =
    typeof nutrient.defaultDaily === 'number' ? nutrient.defaultDaily : 0;
  return accumulator;
}, {});

const mustCompleteKeys = [
  'protein',
  'vitamin_d',
  'magnesium',
  'vitamin_b12',
  'omega3',
  'zinc',
  'potassium',
  'fiber',
  'iron',
  'vitamin_c'
];

await setDoc(
  doc(db, 'sanket', 'profile'),
  {
    name: 'Sanket',
    age: 28,
    gender: 'male',
    heightCm: 180,
    weightKg: 80,
    bmi: 24.7,
    bmr: 1790,
    bmrLabel: '1790 kcal/day',
    maintenanceCalories: {
      min: 2400,
      max: 2500,
      unit: 'kcal/day',
      label: '2400-2500 kcal/day'
    },
    requiredNutrients,
    mustCompleteKeys,
    updatedAt: serverTimestamp()
  },
  { merge: true }
);

console.log('Profile updated for sanket/profile');
