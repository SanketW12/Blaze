import type {
  CommunicationDailyLog,
  CommunicationProgressSnapshot,
  CommunicationSectionItem,
  CommunicationSectionKey,
  CommunicationTaskItem
} from '../types/communication';

const clampPercent = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const clampHomePercent = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value > 100) return 100;
  return value;
};

export const isCommunicationTaskComplete = (task: CommunicationTaskItem) => {
  if (task.type === 'notes') {
    return (task.notes ?? '').trim().length > 0;
  }

  return task.isDone;
};

const isProgressTrackedTask = (task: CommunicationTaskItem) => task.type === 'checkbox';

export const computeCommunicationProgress = (
  sections: CommunicationSectionItem[]
): CommunicationProgressSnapshot => {
  let overallProgress = 0;
  let completedTaskCount = 0;
  let totalTaskCount = 0;
  let completedSectionCount = 0;

  const sectionProgress = {} as Record<CommunicationSectionKey, number>;

  const normalizedSections = sections.map(section => {
    const progressTasks = section.tasks.filter(isProgressTrackedTask);
    const sectionCompletedTaskCount = progressTasks.filter(isCommunicationTaskComplete).length;
    const sectionTotalTaskCount = progressTasks.length;
    const progress =
      sectionTotalTaskCount > 0
        ? clampPercent((sectionCompletedTaskCount / sectionTotalTaskCount) * 100)
        : 0;
    const isComplete =
      sectionTotalTaskCount > 0 && sectionCompletedTaskCount === sectionTotalTaskCount;

    totalTaskCount += sectionTotalTaskCount;
    completedTaskCount += sectionCompletedTaskCount;

    if (isComplete) {
      overallProgress += section.weight;
      completedSectionCount += 1;
    }

    sectionProgress[section.key] = progress;

    return {
      ...section,
      isComplete,
      progress
    };
  });

  return {
    overallProgress: clampPercent(overallProgress),
    homeProgress: clampHomePercent(overallProgress),
    completedTaskCount,
    totalTaskCount,
    completedSectionCount,
    totalSectionCount: normalizedSections.length,
    sectionProgress,
    sections: normalizedSections
  };
};

export const applyCommunicationProgressToLog = (
  log: CommunicationDailyLog
): CommunicationDailyLog => {
  const snapshot = computeCommunicationProgress(log.sections);

  return {
    ...log,
    overallProgress: snapshot.overallProgress,
    completedTaskCount: snapshot.completedTaskCount,
    totalTaskCount: snapshot.totalTaskCount,
    completedSectionCount: snapshot.completedSectionCount,
    totalSectionCount: snapshot.totalSectionCount,
    sectionProgress: snapshot.sectionProgress,
    sections: snapshot.sections
  };
};
