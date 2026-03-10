import { db } from '@/firebase';
import { deleteField, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  DEFAULT_HOME_USER_ID,
  DISCIPLINE_STREAK_THRESHOLD,
  STREAK_COLLECTION
} from '../constants/home';
import type { DisciplineStreakState } from '../types/disciplineStreak';
import {
  addDays,
  buildDisciplineStreakState,
  formatDateKey
} from '../utils/disciplineStreak';

const streakDocRef = (userId: string) => doc(db, STREAK_COLLECTION, userId);

interface DisciplineStreakSummary {
  currentStreakDays: number;
  currentStreakStartDate: string | null;
  currentStreakEndDate: string | null;
  longestStreakDays: number;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
  lastQualifiedDate: string | null;
  totalQualifiedDays: number;
  qualificationProgressThreshold: number;
}

const buildEmptyDisciplineSummary = (): DisciplineStreakSummary => ({
  currentStreakDays: 0,
  currentStreakStartDate: null,
  currentStreakEndDate: null,
  longestStreakDays: 0,
  longestStreakStartDate: null,
  longestStreakEndDate: null,
  lastQualifiedDate: null,
  totalQualifiedDays: 0,
  qualificationProgressThreshold: DISCIPLINE_STREAK_THRESHOLD
});

const mapDisciplineStreakSummary = (value: unknown): DisciplineStreakSummary => {
  if (!value || typeof value !== 'object') {
    return buildEmptyDisciplineSummary();
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
          : DISCIPLINE_STREAK_THRESHOLD
  };
};

const getDisciplineFieldData = (data: Record<string, unknown>) => {
  const streak = data.streak;

  if (!streak || typeof streak !== 'object') {
    return null;
  }

  const streakRecord = streak as Record<string, unknown>;
  return streakRecord.discipline;
};

const getLegacyCompletedDates = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const raw = value as Record<string, unknown>;

  return Array.isArray(raw.completed_dates)
    ? raw.completed_dates.filter((item): item is string => typeof item === 'string')
    : Array.isArray(raw.completedDates)
      ? raw.completedDates.filter((item): item is string => typeof item === 'string')
      : [];
};

const hasLegacyFields = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const raw = value as Record<string, unknown>;
  return (
    'pending_tap_counts' in raw ||
    'pendingTapCounts' in raw ||
    'required_taps' in raw ||
    'tapsRequired' in raw
  );
};

const computeSummaryFromCompletedDates = (completedDates: string[]): DisciplineStreakSummary => {
  const sortedDates = [...new Set(completedDates)].sort();

  if (sortedDates.length === 0) {
    return buildEmptyDisciplineSummary();
  }

  let longestStreakDays = 0;
  let longestStreakStartDate: string | null = null;
  let longestStreakEndDate: string | null = null;
  let runningStreakDays = 0;
  let runningStartDate: string | null = null;
  let previousDate: string | null = null;

  sortedDates.forEach(date => {
    if (!previousDate || formatDateKey(addDays(new Date(`${previousDate}T00:00:00`), 1)) !== date) {
      runningStreakDays = 1;
      runningStartDate = date;
    } else {
      runningStreakDays += 1;
    }

    previousDate = date;

    if (runningStreakDays > longestStreakDays) {
      longestStreakDays = runningStreakDays;
      longestStreakStartDate = runningStartDate;
      longestStreakEndDate = date;
    }
  });

  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(addDays(new Date(`${today}T00:00:00`), -1));
  let currentStreakDays = 0;
  let currentStreakStartDate: string | null = null;
  let currentStreakEndDate: string | null = null;
  const completedDateSet = new Set(sortedDates);
  const latestCompletedDate = sortedDates.at(-1) ?? null;

  // Keep streak active if latest completion is today or yesterday.
  if (latestCompletedDate && (latestCompletedDate === today || latestCompletedDate === yesterday)) {
    currentStreakDays = 1;
    currentStreakStartDate = latestCompletedDate;
    currentStreakEndDate = latestCompletedDate;

    let cursor = new Date(`${latestCompletedDate}T00:00:00`);
    while (true) {
      cursor = addDays(cursor, -1);
      const cursorDate = formatDateKey(cursor);
      if (!completedDateSet.has(cursorDate)) {
        break;
      }

      currentStreakStartDate = cursorDate;
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
    lastQualifiedDate: sortedDates.at(-1) ?? null,
    totalQualifiedDays: sortedDates.length,
    qualificationProgressThreshold: DISCIPLINE_STREAK_THRESHOLD
  };
};

const buildStreakWritePayload = (
  summary: DisciplineStreakSummary,
  completedDates: string[]
) => ({
  current_streak_days: summary.currentStreakDays,
  current_streak_start_date: summary.currentStreakStartDate,
  current_streak_end_date: summary.currentStreakEndDate,
  last_qualified_date: summary.lastQualifiedDate,
  longest_streak_days: summary.longestStreakDays,
  longest_streak_end_date: summary.longestStreakEndDate,
  longest_streak_start_date: summary.longestStreakStartDate,
  qualification_progress_threshold: summary.qualificationProgressThreshold,
  total_qualified_days: summary.totalQualifiedDays,
  completed_dates: [...new Set(completedDates)].sort(),
  completedDates: deleteField(),
  pending_tap_counts: deleteField(),
  pendingTapCounts: deleteField(),
  required_taps: deleteField(),
  tapsRequired: deleteField()
});

const loadDisciplineStreakState = async (userId: string) => {
  const snapshot = await getDoc(streakDocRef(userId));

  if (!snapshot.exists()) {
    return buildDisciplineStreakState({
      ...buildEmptyDisciplineSummary(),
      completedWeekDates: []
    });
  }

  const data = snapshot.data() as Record<string, unknown>;
  const rawDiscipline = getDisciplineFieldData(data);
  const legacyCompletedDates = getLegacyCompletedDates(rawDiscipline);
  const mappedSummary = mapDisciplineStreakSummary(rawDiscipline);
  const summary = legacyCompletedDates.length > 0
    ? computeSummaryFromCompletedDates(legacyCompletedDates)
    : mappedSummary;

  if (hasLegacyFields(rawDiscipline)) {
    await runTransaction(db, async transaction => {
      const freshSnapshot = await transaction.get(streakDocRef(userId));
      transaction.set(
        streakDocRef(userId),
        {
          user_id: userId,
          streak: {
            discipline: buildStreakWritePayload(summary, legacyCompletedDates)
          },
          ...(freshSnapshot.exists() ? {} : { created_at: serverTimestamp() }),
          updated_at: serverTimestamp()
        },
        { merge: true }
      );
    });
  }

  return buildDisciplineStreakState({
    ...summary,
    completedWeekDates: legacyCompletedDates
  });
};

export const disciplineStreakService = {
  async getDisciplineStreak(
    userId = DEFAULT_HOME_USER_ID
  ): Promise<DisciplineStreakState> {
    return loadDisciplineStreakState(userId);
  },

  async completeToday(
    userId = DEFAULT_HOME_USER_ID
  ): Promise<DisciplineStreakState> {
    const today = formatDateKey(new Date());
    const ref = streakDocRef(userId);

    await runTransaction(db, async transaction => {
      const streakSnapshot = await transaction.get(ref);

      const data = streakSnapshot.exists()
        ? (streakSnapshot.data() as Record<string, unknown>)
        : {};
      const rawDiscipline = getDisciplineFieldData(data);
      const legacyCompletedDates = getLegacyCompletedDates(rawDiscipline);
      const completedDatesSet = new Set(legacyCompletedDates);
      if (completedDatesSet.has(today)) {
        return;
      }
      completedDatesSet.add(today);
      const nextCompletedDates = [...completedDatesSet].sort();
      const nextSummary = computeSummaryFromCompletedDates(nextCompletedDates);

      transaction.set(
        ref,
        {
          user_id: userId,
          streak: {
            discipline: buildStreakWritePayload(nextSummary, nextCompletedDates)
          },
          ...(streakSnapshot.exists() ? {} : { created_at: serverTimestamp() }),
          updated_at: serverTimestamp()
        },
        { merge: true }
      );
    });

    return loadDisciplineStreakState(userId);
  },

  async resetCurrentStreak(
    userId = DEFAULT_HOME_USER_ID
  ): Promise<DisciplineStreakState> {
    const ref = streakDocRef(userId);

    await runTransaction(db, async transaction => {
      const streakSnapshot = await transaction.get(ref);
      if (!streakSnapshot.exists()) {
        return;
      }

      const data = streakSnapshot.data() as Record<string, unknown>;
      const rawDiscipline = getDisciplineFieldData(data);
      const legacyCompletedDates = getLegacyCompletedDates(rawDiscipline);
      const previousSummary = computeSummaryFromCompletedDates(legacyCompletedDates);
      const trimmedCompletedDates = legacyCompletedDates.filter(date => {
        if (!previousSummary.currentStreakStartDate || !previousSummary.currentStreakEndDate) {
          return true;
        }

        return (
          date < previousSummary.currentStreakStartDate ||
          date > previousSummary.currentStreakEndDate
        );
      });
      const resetSummary = computeSummaryFromCompletedDates(trimmedCompletedDates);


      transaction.set(
        ref,
        {
          user_id: userId,
          streak: {
            discipline: buildStreakWritePayload(resetSummary, trimmedCompletedDates)
          },
          updated_at: serverTimestamp()
        },
        { merge: true }
      );
    });

    return loadDisciplineStreakState(userId);
  },

  async toggleDateCompletion(
    date: string,
    completed: boolean,
    userId = DEFAULT_HOME_USER_ID
  ): Promise<DisciplineStreakState> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return loadDisciplineStreakState(userId);
    }

    const today = formatDateKey(new Date());
    if (date > today) {
      return loadDisciplineStreakState(userId);
    }

    const ref = streakDocRef(userId);
    await runTransaction(db, async transaction => {
      const streakSnapshot = await transaction.get(ref);
      const data = streakSnapshot.exists()
        ? (streakSnapshot.data() as Record<string, unknown>)
        : {};
      const rawDiscipline = getDisciplineFieldData(data);
      const currentCompletedDates = getLegacyCompletedDates(rawDiscipline);
      const completedDatesSet = new Set(currentCompletedDates);

      if (completed) {
        completedDatesSet.add(date);
      } else {
        completedDatesSet.delete(date);
      }

      const nextCompletedDates = [...completedDatesSet].sort();
      const nextSummary = computeSummaryFromCompletedDates(nextCompletedDates);

      transaction.set(
        ref,
        {
          user_id: userId,
          streak: {
            discipline: buildStreakWritePayload(nextSummary, nextCompletedDates)
          },
          ...(streakSnapshot.exists() ? {} : { created_at: serverTimestamp() }),
          updated_at: serverTimestamp()
        },
        { merge: true }
      );
    });

    return loadDisciplineStreakState(userId);
  }
};
