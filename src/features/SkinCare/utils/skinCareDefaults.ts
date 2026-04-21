import {
  DEFAULT_SKINCARE_USER_ID,
  SKIN_CARE_ROUTINES
} from '../constants/skinCare';
import type { SkinCareDailyLog } from '../types/skinCare';

export const getTodaySkinCareDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

export const computeSkinCareProgress = (log: SkinCareDailyLog) => {
  const totalCount = log.routines.reduce(
    (sum, routine) => sum + routine.steps.length,
    0
  );
  const completedCount = log.routines.reduce(
    (sum, routine) => sum + routine.steps.filter(step => step.checked).length,
    0
  );
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return {
    totalCount,
    completedCount,
    overallProgress
  };
};

export const buildDefaultSkinCareDailyLog = ({
  date = getTodaySkinCareDate(),
  userId = DEFAULT_SKINCARE_USER_ID
}: {
  date?: string;
  userId?: string;
} = {}): SkinCareDailyLog => {
  const base: SkinCareDailyLog = {
    id: `${userId}_${date}`,
    userId,
    logDate: date,
    routines: SKIN_CARE_ROUTINES.map(routine => ({
      ...routine,
      steps: routine.steps.map(step => ({
        ...step,
        checked: false
      }))
    })),
    overallProgress: 0,
    completedCount: 0,
    totalCount: 0,
    createdAt: null,
    updatedAt: null
  };

  const progress = computeSkinCareProgress(base);
  return {
    ...base,
    ...progress
  };
};
