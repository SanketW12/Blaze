import { db } from '@/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  DEFAULT_SKINCARE_USER_ID,
  SKIN_CARE_COLLECTION
} from '../constants/skinCare';
import type { SkinCareDailyLog } from '../types/skinCare';
import {
  buildDefaultSkinCareDailyLog,
  computeSkinCareProgress
} from '../utils/skinCareDefaults';

const skinCareDocRef = (date: string, userId: string) =>
  doc(db, SKIN_CARE_COLLECTION, `${userId}_${date}`);

const mapSkinCareLog = ({
  data,
  fallback
}: {
  data: Record<string, unknown>;
  fallback: SkinCareDailyLog;
}): SkinCareDailyLog => {
  const rawRoutines = Array.isArray(data.routines) ? data.routines : [];
  const routineByKey = rawRoutines.reduce<Record<string, Record<string, unknown>>>(
    (acc, item) => {
      if (!item || typeof item !== 'object') return acc;
      const record = item as Record<string, unknown>;
      if (typeof record.key === 'string') {
        acc[record.key] = record;
      }
      return acc;
    },
    {}
  );

  const routines = fallback.routines.map(routine => {
    const rawRoutine = routineByKey[routine.key];
    const rawSteps = Array.isArray(rawRoutine?.steps) ? rawRoutine.steps : [];
    const stepById = rawSteps.reduce<Record<string, Record<string, unknown>>>((acc, step) => {
      if (!step || typeof step !== 'object') return acc;
      const record = step as Record<string, unknown>;
      if (typeof record.id === 'string') {
        acc[record.id] = record;
      }
      return acc;
    }, {});

    return {
      ...routine,
      steps: routine.steps.map(step => ({
        ...step,
        checked: stepById[step.id]?.checked === true
      }))
    };
  });

  const mapped: SkinCareDailyLog = {
    ...fallback,
    routines,
    createdAt: data.created_at ?? data.createdAt ?? null,
    updatedAt: data.updated_at ?? data.updatedAt ?? null
  };

  return {
    ...mapped,
    ...computeSkinCareProgress(mapped)
  };
};

export const skinCareDataService = {
  async getSkinCareDailyLog(
    date: string,
    userId = DEFAULT_SKINCARE_USER_ID
  ): Promise<SkinCareDailyLog | null> {
    const snapshot = await getDoc(skinCareDocRef(date, userId));
    if (!snapshot.exists()) return null;

    return mapSkinCareLog({
      data: snapshot.data() as Record<string, unknown>,
      fallback: buildDefaultSkinCareDailyLog({ date, userId })
    });
  },

  async getTodaySkinCareLog(userId = DEFAULT_SKINCARE_USER_ID) {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(today.getDate()).padStart(2, '0')}`;
    return this.getSkinCareDailyLog(date, userId);
  },

  async saveSkinCareDailyLog(log: SkinCareDailyLog): Promise<SkinCareDailyLog> {
    const ref = skinCareDocRef(log.logDate, log.userId);
    const snapshot = await getDoc(ref);
    const normalized = {
      ...log,
      ...computeSkinCareProgress(log)
    };

    await setDoc(
      ref,
      {
        user_id: normalized.userId,
        log_date: normalized.logDate,
        routines: normalized.routines.map(routine => ({
          key: routine.key,
          label: routine.label,
          steps: routine.steps.map(step => ({
            id: step.id,
            label: step.label,
            how: step.how,
            quantity: step.quantity,
            use: step.use,
            optional: step.optional ?? false,
            checked: step.checked
          }))
        })),
        overall_progress: normalized.overallProgress,
        completed_count: normalized.completedCount,
        total_count: normalized.totalCount,
        ...(snapshot.exists() ? {} : { created_at: serverTimestamp() }),
        updated_at: serverTimestamp()
      },
      { merge: true }
    );

    return normalized;
  }
};
