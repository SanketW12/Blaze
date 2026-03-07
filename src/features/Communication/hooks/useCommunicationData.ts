import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_COMMUNICATION_USER_ID } from '../constants/communication';
import { communicationDataService } from '../services/communicationDataService';
import type {
  CommunicationAiContent,
  CommunicationAiContentKey,
  CommunicationArticlePractice,
  CommunicationDailyLog,
  CommunicationFeatureStreak,
  CommunicationGrammarTestSummary,
  CommunicationSectionKey
} from '../types/communication';
import {
  buildDefaultCommunicationDailyLog,
  getTodayCommunicationDate
} from '../utils/communicationDefaults';
import { applyCommunicationProgressToLog } from '../utils/communicationProgress';

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to update communication progress.';

export const useCommunicationData = () => {
  const [log, setLog] = useState<CommunicationDailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<CommunicationDailyLog[]>([]);
  const [streak, setStreak] = useState<CommunicationFeatureStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = getTodayCommunicationDate();

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [remoteLog, recentCommunicationLogs, remoteStreak] = await Promise.all([
        communicationDataService.getCommunicationDailyLog(
          date,
          DEFAULT_COMMUNICATION_USER_ID
        ),
        communicationDataService.listRecentCommunicationLogs(
          DEFAULT_COMMUNICATION_USER_ID
        ),
        communicationDataService.getCommunicationStreak(
          DEFAULT_COMMUNICATION_USER_ID
        )
      ]);

      setLog(
        remoteLog ??
          buildDefaultCommunicationDailyLog({
            date,
            userId: DEFAULT_COMMUNICATION_USER_ID
          })
      );
      setRecentLogs(recentCommunicationLogs);
      setStreak(remoteStreak);
    } catch (refreshError) {
      setError(normalizeError(refreshError));
      setLog(
        buildDefaultCommunicationDailyLog({
          date,
          userId: DEFAULT_COMMUNICATION_USER_ID
        })
      );
      setRecentLogs([]);
      setStreak(null);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const persistLog = useCallback(async (nextLog: CommunicationDailyLog) => {
    const normalized = applyCommunicationProgressToLog(nextLog);
    setLog(normalized);
    setRecentLogs(current => {
      const nextLogs = [
        normalized,
        ...current.filter(item => item.logDate !== normalized.logDate)
      ];

      return nextLogs.sort((left, right) => right.logDate.localeCompare(left.logDate));
    });
    setIsSaving(true);
    setError(null);

    try {
      const nextStreak = await communicationDataService.saveCommunicationDailyLog(normalized);
      setStreak(nextStreak);
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateCurrentLog = useCallback(
    async (updater: (current: CommunicationDailyLog) => CommunicationDailyLog) => {
      const baseLog =
        log ??
        buildDefaultCommunicationDailyLog({
          date,
          userId: DEFAULT_COMMUNICATION_USER_ID
        });

      await persistLog(updater(baseLog));
    },
    [date, log, persistLog]
  );

  const toggleTask = useCallback(
    async (sectionKey: CommunicationSectionKey, taskId: string, checked: boolean) => {
      await updateCurrentLog(current => ({
        ...current,
        sections: current.sections.map(section =>
          section.key !== sectionKey
            ? section
            : {
                ...section,
                tasks: section.tasks.map(task =>
                  task.id !== taskId
                    ? task
                    : {
                        ...task,
                        isDone: checked,
                        completedAt: checked ? new Date().toISOString() : null
                      }
                )
              }
        )
      }));
    },
    [updateCurrentLog]
  );

  const saveGrammarTestSummary = useCallback(
    async (grammarTestSummary: CommunicationGrammarTestSummary) => {
      await updateCurrentLog(current => ({
        ...current,
        grammarTestSummary
      }));
    },
    [updateCurrentLog]
  );

  const saveAiGeneratedContent = useCallback(
    async (
      key: CommunicationAiContentKey,
      content: CommunicationAiContent
    ) => {
      await updateCurrentLog(current => ({
        ...current,
        aiGeneratedExercises: {
          ...current.aiGeneratedExercises,
          [key]: content
        }
      }));
    },
    [updateCurrentLog]
  );

  const updateArticlePractice = useCallback(
    async (patch: Partial<CommunicationArticlePractice>) => {
      await updateCurrentLog(current => ({
        ...current,
        articlePractice: {
          ...current.articlePractice,
          ...patch
        }
      }));
    },
    [updateCurrentLog]
  );

  return {
    log,
    recentLogs,
    streak,
    isLoading,
    isSaving,
    error,
    refreshData,
    toggleTask,
    saveGrammarTestSummary,
    saveAiGeneratedContent,
    updateArticlePractice
  };
};
