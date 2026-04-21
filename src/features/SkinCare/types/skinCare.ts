export type SkinRoutineKey = 'morning' | 'night';

export interface SkinCareStepTemplate {
  id: string;
  label: string;
  how: string;
  quantity: string;
  use: string;
  optional?: boolean;
}

export interface SkinCareStepItem extends SkinCareStepTemplate {
  checked: boolean;
}

export interface SkinCareRoutineItem {
  key: SkinRoutineKey;
  label: string;
  steps: SkinCareStepItem[];
}

export interface SkinCareRoutineTemplate {
  key: SkinRoutineKey;
  label: string;
  steps: SkinCareStepTemplate[];
}

export interface SkinCareDailyLog {
  id: string;
  userId: string;
  logDate: string;
  routines: SkinCareRoutineItem[];
  overallProgress: number;
  completedCount: number;
  totalCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}
