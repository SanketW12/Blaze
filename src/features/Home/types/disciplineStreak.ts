export interface DisciplineWeekDayItem {
  label: string;
  date: string;
  active: boolean;
  isToday: boolean;
}

export interface DisciplineStreakState {
  currentStreakDays: number;
  currentStreakStartDate: string | null;
  currentStreakEndDate: string | null;
  longestStreakDays: number;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
  lastQualifiedDate: string | null;
  totalQualifiedDays: number;
  qualificationProgressThreshold: number;
  weekDays: DisciplineWeekDayItem[];
}
