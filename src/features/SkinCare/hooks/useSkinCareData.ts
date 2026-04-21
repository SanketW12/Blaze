import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SKINCARE_USER_ID } from '../constants/skinCare';
import { skinCareDataService } from '../services/skinCareDataService';
import type { SkinCareDailyLog, SkinRoutineKey } from '../types/skinCare';
import {
  buildDefaultSkinCareDailyLog,
  getTodaySkinCareDate
} from '../utils/skinCareDefaults';

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to update skin care progress.';

export const useSkinCareData = () => {
  const [log, setLog] = useState<SkinCareDailyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = getTodaySkinCareDate();

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const remoteLog = await skinCareDataService.getSkinCareDailyLog(
        date,
        DEFAULT_SKINCARE_USER_ID
      );
      setLog(
        remoteLog ??
          buildDefaultSkinCareDailyLog({
            date,
            userId: DEFAULT_SKINCARE_USER_ID
          })
      );
    } catch (refreshError) {
      setError(normalizeError(refreshError));
      setLog(buildDefaultSkinCareDailyLog({ date, userId: DEFAULT_SKINCARE_USER_ID }));
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const persistLog = useCallback(async (nextLog: SkinCareDailyLog) => {
    setLog(nextLog);
    setIsSaving(true);
    setError(null);
    try {
      const saved = await skinCareDataService.saveSkinCareDailyLog(nextLog);
      setLog(saved);
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const toggleStep = useCallback(
    async (routineKey: SkinRoutineKey, stepId: string, checked: boolean) => {
      const baseLog =
        log ??
        buildDefaultSkinCareDailyLog({
          date,
          userId: DEFAULT_SKINCARE_USER_ID
        });

      const nextLog: SkinCareDailyLog = {
        ...baseLog,
        routines: baseLog.routines.map(routine =>
          routine.key !== routineKey
            ? routine
            : {
                ...routine,
                steps: routine.steps.map(step =>
                  step.id !== stepId ? step : { ...step, checked }
                )
              }
        )
      };

      await persistLog(nextLog);
    },
    [date, log, persistLog]
  );

  return { log, isLoading, isSaving, error, refreshData, toggleStep };
};
