import { initializeApp } from 'firebase/app';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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

const profileRef = doc(db, 'sanket', 'profile');
const profileSnap = await getDoc(profileRef);

if (!profileSnap.exists()) {
  console.log('Profile not found at sanket/profile');
  process.exit(0);
}

const profile = profileSnap.data();

await setDoc(
  profileRef,
  {
    name: profile.name ?? '',
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    heightCm: profile.heightCm ?? profile.height_cm ?? null,
    weightKg: profile.weightKg ?? profile.weight_kg ?? null,
    activityLevel: profile.activityLevel ?? profile.activity_level ?? null,
    bmi: profile.bmi ?? null,
    bmr: profile.bmr ?? null,
    bmrLabel: profile.bmrLabel ?? profile.bmr_label ?? null,
    maintenanceCalories:
      profile.maintenanceCalories ?? profile.maintenance_calories ?? null,
    requiredNutrients:
      profile.requiredNutrients ?? profile.required_nutrients ?? {},
    mustCompleteKeys:
      profile.mustCompleteKeys ?? profile.must_complete_keys ?? [],
    height_cm: deleteField(),
    weight_kg: deleteField(),
    activity_level: deleteField(),
    bmr_label: deleteField(),
    maintenance_calories: deleteField(),
    required_nutrients: deleteField(),
    must_complete_keys: deleteField(),
    updatedAt: serverTimestamp()
  },
  { merge: true }
);

console.log('Normalized profile to camelCase keys only.');
