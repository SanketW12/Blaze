import { DISCIPLINE_STREAK_THRESHOLD } from '../constants/home';
import type { DisciplineStreakState, DisciplineWeekDayItem } from '../types/disciplineStreak';

export interface DisciplineStreakSource {
  currentStreakDays: number;
  currentStreakStartDate: string | null;
  currentStreakEndDate: string | null;
  longestStreakDays: number;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
  lastQualifiedDate: string | null;
  totalQualifiedDays: number;
  qualificationProgressThreshold?: number;
  completedWeekDates: string[];
}

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const sanitizeCompletedDates = (dates: string[]) =>
  [...new Set(dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();

const buildCompletedWeekDatesFromCurrentStreak = (
  currentStreakStartDate: string | null,
  currentStreakEndDate: string | null
) => {
  if (!currentStreakStartDate || !currentStreakEndDate) {
    return [];
  }

  const start = new Date(`${currentStreakStartDate}T00:00:00`);
  const end = new Date(`${currentStreakEndDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const buildWeekDays = (
  completedDateSet: Set<string>,
  today: string
): DisciplineWeekDayItem[] => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(now, mondayOffset);
  const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return weekLabels.map((label, index) => {
    const date = addDays(monday, index);
    const dateKey = formatDateKey(date);

    return {
      label,
      date: dateKey,
      active: completedDateSet.has(dateKey),
      isToday: dateKey === today
    };
  });
};

export const buildDisciplineStreakState = ({
  currentStreakDays,
  currentStreakStartDate,
  currentStreakEndDate,
  longestStreakDays,
  longestStreakStartDate,
  longestStreakEndDate,
  lastQualifiedDate,
  totalQualifiedDays,
  qualificationProgressThreshold = DISCIPLINE_STREAK_THRESHOLD,
  completedWeekDates
}: DisciplineStreakSource): DisciplineStreakState => {
  const normalizedCompletedWeekDates = sanitizeCompletedDates(
    completedWeekDates.length > 0
      ? completedWeekDates
      : buildCompletedWeekDatesFromCurrentStreak(currentStreakStartDate, currentStreakEndDate)
  );
  const today = formatDateKey(new Date());
  const completedDateSet = new Set(normalizedCompletedWeekDates);

  return {
    currentStreakDays,
    currentStreakStartDate,
    currentStreakEndDate,
    longestStreakDays,
    longestStreakStartDate,
    longestStreakEndDate,
    lastQualifiedDate,
    totalQualifiedDays,
    qualificationProgressThreshold,
    weekDays: buildWeekDays(completedDateSet, today)
  };
};

export const buildEmptyDisciplineStreakState = () =>
  buildDisciplineStreakState({
    currentStreakDays: 0,
    currentStreakStartDate: null,
    currentStreakEndDate: null,
    longestStreakDays: 0,
    longestStreakStartDate: null,
    longestStreakEndDate: null,
    lastQualifiedDate: null,
    totalQualifiedDays: 0,
    qualificationProgressThreshold: DISCIPLINE_STREAK_THRESHOLD,
    completedWeekDates: []
  });
