import { useEffect, useMemo } from 'react';
import { useHomeStore } from '@/features/Home/store';
import type { CommunicationDailyLog } from '../types/communication';
import { computeCommunicationProgress } from '../utils/communicationProgress';

export const useCommunicationProgress = (log: CommunicationDailyLog | null) => {
  const setCommunicationProgress = useHomeStore(
    state => state.setCommunicationProgress
  );

  const progress = useMemo(() => {
    if (!log) {
      return {
        overallProgress: 0,
        homeProgress: 1,
        completedTaskCount: 0,
        totalTaskCount: 0,
        completedSectionCount: 0,
        totalSectionCount: 0,
        sectionProgress: {
          englishFluency: 0,
          tongueTwisters: 0,
          smoothCalmSpeaking: 0,
          speechClarityDrill: 0,
          thoughtStructuring: 0,
          tonality: 0,
          articlePresentation: 0,
          grammar: 0,
          mindfulSpeaking: 0
        },
        sections: []
      };
    }

    return computeCommunicationProgress(log.sections);
  }, [log]);

  useEffect(() => {
    setCommunicationProgress(progress.homeProgress);
  }, [progress.homeProgress, setCommunicationProgress]);

  return progress;
};
