import { db } from '@/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import {
  COMMUNICATION_COLLECTION,
  DEFAULT_COMMUNICATION_USER_ID
} from '../constants/communication';
import type {
  CommunicationAiContent,
  CommunicationAiContentKey,
  CommunicationArticlePractice,
  CommunicationDailyLog,
  CommunicationFeatureStreak,
  CommunicationGrammarTestSummary,
  CommunicationSectionItem,
  CommunicationTaskItem
} from '../types/communication';
import { buildDefaultCommunicationDailyLog } from '../utils/communicationDefaults';
import { applyCommunicationProgressToLog } from '../utils/communicationProgress';

const createCommunicationLogId = (date: string, userId: string) => `${userId}_${date}`;
const STREAK_COLLECTION = 'streak';
const COMMUNICATION_STREAK_THRESHOLD = 80;

const communicationDocRef = (date: string, userId: string) =>
  doc(db, COMMUNICATION_COLLECTION, createCommunicationLogId(date, userId));

const communicationCollectionRef = () => collection(db, COMMUNICATION_COLLECTION);
const streakDocRef = (userId: string) => doc(db, STREAK_COLLECTION, userId);

const mapTask = (
  rawTask: unknown,
  fallbackTask: CommunicationTaskItem
): CommunicationTaskItem => {
  if (!rawTask || typeof rawTask !== 'object') {
    return fallbackTask;
  }

  const task = rawTask as Record<string, unknown>;

  return {
    ...fallbackTask,
    isDone: task.is_done === true || task.isDone === true,
    notes:
      typeof task.notes === 'string'
        ? task.notes
        : fallbackTask.notes,
    completedAt:
      typeof task.completed_at === 'string'
        ? task.completed_at
        : typeof task.completedAt === 'string'
          ? task.completedAt
          : fallbackTask.completedAt
  };
};

const mapSection = (
  rawSection: unknown,
  fallbackSection: CommunicationSectionItem
): CommunicationSectionItem => {
  if (!rawSection || typeof rawSection !== 'object') {
    return fallbackSection;
  }

  const section = rawSection as Record<string, unknown>;
  const rawTasks = Array.isArray(section.tasks) ? section.tasks : [];
  const rawTaskById = rawTasks.reduce<Record<string, unknown>>((accumulator, rawTask) => {
    if (!rawTask || typeof rawTask !== 'object') {
      return accumulator;
    }

    const task = rawTask as Record<string, unknown>;
    if (typeof task.id === 'string' && task.id.trim().length > 0) {
      accumulator[task.id] = rawTask;
    }

    return accumulator;
  }, {});

  return {
    ...fallbackSection,
    tasks: fallbackSection.tasks.map(task =>
      mapTask(rawTaskById[task.id] ?? null, task)
    )
  };
};

const mapArticlePractice = (
  value: unknown,
  fallback: CommunicationArticlePractice
): CommunicationArticlePractice => {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Record<string, unknown>;

  return {
    source:
      raw.source === 'economic_times' || raw.source === 'indian_express'
        ? raw.source
        : fallback.source,
    articleTitle:
      typeof raw.article_title === 'string'
        ? raw.article_title
        : typeof raw.articleTitle === 'string'
          ? raw.articleTitle
          : fallback.articleTitle,
    articleUrl:
      typeof raw.article_url === 'string'
        ? raw.article_url
        : typeof raw.articleUrl === 'string'
          ? raw.articleUrl
          : fallback.articleUrl,
    notes: typeof raw.notes === 'string' ? raw.notes : fallback.notes,
    selfReviewNotes:
      typeof raw.self_review_notes === 'string'
        ? raw.self_review_notes
        : typeof raw.selfReviewNotes === 'string'
          ? raw.selfReviewNotes
          : fallback.selfReviewNotes
  };
};

const mapGrammarTestSummary = (
  value: unknown
): CommunicationGrammarTestSummary | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];

  return {
    questions: rawQuestions
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const question = item as Record<string, unknown>;
        const prompt =
          typeof question.prompt === 'string' ? question.prompt.trim() : '';

        if (!prompt) return null;

        return {
          id:
            typeof question.id === 'string' && question.id.trim()
              ? question.id.trim()
              : `q${index + 1}`,
          prompt,
          answer: typeof question.answer === 'string' ? question.answer : ''
        };
      })
      .filter(Boolean) as CommunicationGrammarTestSummary['questions'],
    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [],
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        )
      : [],
    completedAt:
      typeof raw.completed_at === 'string'
        ? raw.completed_at
        : typeof raw.completedAt === 'string'
          ? raw.completedAt
          : null
  };
};

const mapAiGeneratedExercises = (
  value: unknown
): Partial<Record<CommunicationAiContentKey, CommunicationAiContent>> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Partial<Record<CommunicationAiContentKey, CommunicationAiContent>>
  >((accumulator, [key, item]) => {
    if (!item || typeof item !== 'object') {
      return accumulator;
    }

    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    const items = Array.isArray(raw.items)
      ? raw.items.filter(
          (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
        )
      : [];

    if (!title || items.length === 0) {
      return accumulator;
    }

    accumulator[key as CommunicationAiContentKey] = {
      title,
      summary,
      items,
      generatedAt:
        typeof raw.generated_at === 'string'
          ? raw.generated_at
          : typeof raw.generatedAt === 'string'
            ? raw.generatedAt
            : null
    };

    return accumulator;
  }, {});
};

const buildEmptyCommunicationStreak = (): CommunicationFeatureStreak => ({
  currentStreakDays: 0,
  currentStreakStartDate: null,
  currentStreakEndDate: null,
  longestStreakDays: 0,
  longestStreakStartDate: null,
  longestStreakEndDate: null,
  lastQualifiedDate: null,
  totalQualifiedDays: 0,
  qualificationProgressThreshold: COMMUNICATION_STREAK_THRESHOLD
});

const mapCommunicationStreak = (
  value: unknown
): CommunicationFeatureStreak => {
  if (!value || typeof value !== 'object') {
    return buildEmptyCommunicationStreak();
  }

  const raw = value as Record<string, unknown>;

  return {
    currentStreakDays:
      typeof raw.current_streak_days === 'number'
        ? raw.current_streak_days
        : typeof raw.currentStreakDays === 'number'
          ? raw.currentStreakDays
          : 0,
    currentStreakStartDate:
      typeof raw.current_streak_start_date === 'string'
        ? raw.current_streak_start_date
        : typeof raw.currentStreakStartDate === 'string'
          ? raw.currentStreakStartDate
          : null,
    currentStreakEndDate:
      typeof raw.current_streak_end_date === 'string'
        ? raw.current_streak_end_date
        : typeof raw.currentStreakEndDate === 'string'
          ? raw.currentStreakEndDate
          : null,
    longestStreakDays:
      typeof raw.longest_streak_days === 'number'
        ? raw.longest_streak_days
        : typeof raw.longestStreakDays === 'number'
          ? raw.longestStreakDays
          : 0,
    longestStreakStartDate:
      typeof raw.longest_streak_start_date === 'string'
        ? raw.longest_streak_start_date
        : typeof raw.longestStreakStartDate === 'string'
          ? raw.longestStreakStartDate
          : null,
    longestStreakEndDate:
      typeof raw.longest_streak_end_date === 'string'
        ? raw.longest_streak_end_date
        : typeof raw.longestStreakEndDate === 'string'
          ? raw.longestStreakEndDate
          : null,
    lastQualifiedDate:
      typeof raw.last_qualified_date === 'string'
        ? raw.last_qualified_date
        : typeof raw.lastQualifiedDate === 'string'
          ? raw.lastQualifiedDate
          : null,
    totalQualifiedDays:
      typeof raw.total_qualified_days === 'number'
        ? raw.total_qualified_days
        : typeof raw.totalQualifiedDays === 'number'
          ? raw.totalQualifiedDays
          : 0,
    qualificationProgressThreshold:
      typeof raw.qualification_progress_threshold === 'number'
        ? raw.qualification_progress_threshold
        : typeof raw.qualificationProgressThreshold === 'number'
          ? raw.qualificationProgressThreshold
          : COMMUNICATION_STREAK_THRESHOLD
  };
};

const computeCommunicationStreakFromLogs = (
  recentLogs: CommunicationDailyLog[]
): CommunicationFeatureStreak => {
  const qualifiedLogs = recentLogs
    .filter(log => log.overallProgress >= COMMUNICATION_STREAK_THRESHOLD)
    .sort((left, right) => left.logDate.localeCompare(right.logDate));

  if (qualifiedLogs.length === 0) {
    return buildEmptyCommunicationStreak();
  }

  const addDays = (dateValue: string, days: number) => {
    const date = new Date(`${dateValue}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  let longestStreakDays = 0;
  let longestStreakStartDate: string | null = null;
  let longestStreakEndDate: string | null = null;
  let runningStreakDays = 0;
  let runningStartDate: string | null = null;
  let previousDate: string | null = null;

  qualifiedLogs.forEach(log => {
    if (!previousDate || addDays(previousDate, 1) !== log.logDate) {
      runningStreakDays = 1;
      runningStartDate = log.logDate;
    } else {
      runningStreakDays += 1;
    }

    previousDate = log.logDate;

    if (runningStreakDays > longestStreakDays) {
      longestStreakDays = runningStreakDays;
      longestStreakStartDate = runningStartDate;
      longestStreakEndDate = log.logDate;
    }
  });

  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  })();

  let currentStreakDays = 0;
  let currentStreakStartDate: string | null = null;
  let currentStreakEndDate: string | null = null;
  const qualifiedDateSet = new Set(qualifiedLogs.map(log => log.logDate));

  if (qualifiedDateSet.has(today)) {
    currentStreakEndDate = today;
    currentStreakStartDate = today;
    currentStreakDays = 1;

    let cursor = today;
    while (qualifiedDateSet.has(addDays(cursor, -1))) {
      cursor = addDays(cursor, -1);
      currentStreakStartDate = cursor;
      currentStreakDays += 1;
    }
  }

  return {
    currentStreakDays,
    currentStreakStartDate,
    currentStreakEndDate,
    longestStreakDays,
    longestStreakStartDate,
    longestStreakEndDate,
    lastQualifiedDate: qualifiedLogs.at(-1)?.logDate ?? null,
    totalQualifiedDays: qualifiedLogs.length,
    qualificationProgressThreshold: COMMUNICATION_STREAK_THRESHOLD
  };
};

const mapCommunicationDailyLogData = ({
  id,
  data,
  fallback
}: {
  id: string;
  data: Record<string, unknown>;
  fallback: CommunicationDailyLog;
}): CommunicationDailyLog => {
  const rawSections = Array.isArray(data.sections) ? data.sections : [];
  const rawSectionByKey = rawSections.reduce<Record<string, unknown>>((accumulator, rawSection) => {
    if (!rawSection || typeof rawSection !== 'object') {
      return accumulator;
    }

    const section = rawSection as Record<string, unknown>;
    if (typeof section.key === 'string' && section.key.trim().length > 0) {
      accumulator[section.key] = rawSection;
    }

    return accumulator;
  }, {});

  return applyCommunicationProgressToLog({
    ...fallback,
    id,
    userId:
      typeof data.user_id === 'string'
        ? data.user_id
        : typeof data.userId === 'string'
          ? data.userId
          : fallback.userId,
    logDate:
      typeof data.log_date === 'string'
        ? data.log_date
        : typeof data.logDate === 'string'
          ? data.logDate
          : fallback.logDate,
    sections: fallback.sections.map(section =>
      mapSection(rawSectionByKey[section.key] ?? null, section)
    ),
    articlePractice: mapArticlePractice(
      data.article_practice ?? data.articlePractice,
      fallback.articlePractice
    ),
    grammarTestSummary: mapGrammarTestSummary(
      data.grammar_test_summary ?? data.grammarTestSummary
    ),
    aiGeneratedExercises: mapAiGeneratedExercises(
      data.ai_generated_exercises ?? data.aiGeneratedExercises
    ),
    createdAt: data.created_at ?? data.createdAt ?? null,
    updatedAt: data.updated_at ?? data.updatedAt ?? null
  });
};

export const communicationDataService = {
  async getCommunicationDailyLog(
    date: string,
    userId = DEFAULT_COMMUNICATION_USER_ID
  ) {
    const snapshot = await getDoc(communicationDocRef(date, userId));
    if (!snapshot.exists()) return null;

    const fallback = buildDefaultCommunicationDailyLog({ date, userId });
    const data = snapshot.data() as Record<string, unknown>;
    return mapCommunicationDailyLogData({
      id: snapshot.id,
      data,
      fallback
    });
  },

  async getTodayCommunicationLog(userId = DEFAULT_COMMUNICATION_USER_ID) {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(today.getDate()).padStart(2, '0')}`;

    return this.getCommunicationDailyLog(date, userId);
  },

  async listRecentCommunicationLogs(
    userId = DEFAULT_COMMUNICATION_USER_ID,
    maxEntries = 90
  ) {
    const snapshot = await getDocs(
      query(
        communicationCollectionRef(),
        orderBy('log_date', 'desc'),
        limit(maxEntries)
      )
    );

    return snapshot.docs
      .map(documentSnapshot => {
        const data = documentSnapshot.data() as Record<string, unknown>;
        const logDate =
          typeof data.log_date === 'string'
            ? data.log_date
            : typeof data.logDate === 'string'
              ? data.logDate
              : '';
        const docUserId =
          typeof data.user_id === 'string'
            ? data.user_id
            : typeof data.userId === 'string'
              ? data.userId
              : userId;

        if (docUserId !== userId || !logDate) {
          return null;
        }

        return mapCommunicationDailyLogData({
          id: documentSnapshot.id,
          data,
          fallback: buildDefaultCommunicationDailyLog({
            date: logDate,
            userId
          })
        });
      })
      .filter((item): item is CommunicationDailyLog => Boolean(item));
  },

  async getCommunicationStreak(userId = DEFAULT_COMMUNICATION_USER_ID) {
    const snapshot = await getDoc(streakDocRef(userId));
    if (!snapshot.exists()) {
      return buildEmptyCommunicationStreak();
    }

    const data = snapshot.data() as Record<string, unknown>;
    const streak = data.streak as Record<string, unknown> | undefined;

    return mapCommunicationStreak(streak?.communication);
  },

  async saveCommunicationDailyLog(log: CommunicationDailyLog) {
    const ref = communicationDocRef(log.logDate, log.userId);
    const snapshot = await getDoc(ref);
    const streakRef = streakDocRef(log.userId);
    const streakSnapshot = await getDoc(streakRef);

    await setDoc(
      ref,
      {
        user_id: log.userId,
        log_date: log.logDate,
        overall_progress: log.overallProgress,
        completed_task_count: log.completedTaskCount,
        total_task_count: log.totalTaskCount,
        completed_section_count: log.completedSectionCount,
        total_section_count: log.totalSectionCount,
        section_progress: log.sectionProgress,
        sections: log.sections.map(section => ({
          key: section.key,
          label: section.label,
          description: section.description,
          weight: section.weight,
          is_complete: section.isComplete,
          progress: section.progress,
          tasks: section.tasks.map(task => ({
            id: task.id,
            label: task.label,
            description: task.description ?? '',
            type: task.type,
            is_done: task.isDone,
            notes: task.notes ?? '',
            completed_at: task.completedAt ?? null
          }))
        })),
        article_practice: {
          source: log.articlePractice.source,
          article_title: log.articlePractice.articleTitle,
          article_url: log.articlePractice.articleUrl,
          notes: log.articlePractice.notes,
          self_review_notes: log.articlePractice.selfReviewNotes
        },
        grammar_test_summary: log.grammarTestSummary
          ? {
              questions: log.grammarTestSummary.questions.map(question => ({
                id: question.id,
                prompt: question.prompt,
                answer: question.answer
              })),
              weaknesses: log.grammarTestSummary.weaknesses,
              recommendations: log.grammarTestSummary.recommendations,
              completed_at: log.grammarTestSummary.completedAt ?? null
            }
          : null,
        ai_generated_exercises: Object.fromEntries(
          Object.entries(log.aiGeneratedExercises).map(([key, value]) => [
            key,
            {
              title: value.title,
              summary: value.summary,
              items: value.items,
              generated_at: value.generatedAt ?? null
            }
          ])
        ),
        ...(snapshot.exists() ? {} : { created_at: serverTimestamp() }),
        updated_at: serverTimestamp()
      },
      { merge: true }
    );

    const recentLogs = await this.listRecentCommunicationLogs(log.userId, 365);
    const communicationStreak = computeCommunicationStreakFromLogs(recentLogs);

    await setDoc(
      streakRef,
      {
        user_id: log.userId,
        streak: {
          communication: {
            current_streak_days: communicationStreak.currentStreakDays,
            current_streak_start_date: communicationStreak.currentStreakStartDate,
            current_streak_end_date: communicationStreak.currentStreakEndDate,
            longest_streak_days: communicationStreak.longestStreakDays,
            longest_streak_start_date: communicationStreak.longestStreakStartDate,
            longest_streak_end_date: communicationStreak.longestStreakEndDate,
            last_qualified_date: communicationStreak.lastQualifiedDate,
            total_qualified_days: communicationStreak.totalQualifiedDays,
            qualification_progress_threshold:
              communicationStreak.qualificationProgressThreshold
          }
        },
        ...(streakSnapshot.exists() ? {} : { created_at: serverTimestamp() }),
        updated_at: serverTimestamp()
      },
      { merge: true }
    );

    return communicationStreak;
  }
};
