import { create } from "zustand";

export type HomeMenuKey = "nutrition" | "learning" | "skills" | "communication";

interface HomeMenuProgress {
  progress: number;
}

interface HomeStoreState {
  menuProgress: Record<HomeMenuKey, HomeMenuProgress>;
  setMenuProgress: (menu: HomeMenuKey, payload: HomeMenuProgress) => void;
  setCommunicationProgress: (progress: number) => void;
  setNutritionCaloriesProgress: (
    consumedCalories: number,
    targetCalories: number,
  ) => void;
}

const clampPercent = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (value > 100) return 100;
  return value;
};

export const useHomeStore = create<HomeStoreState>((set) => ({
  menuProgress: {
    communication: { progress: 1 },
    learning: { progress: 1 },
    skills: { progress: 1 },
    nutrition: { progress: 1 },
  },
  setMenuProgress: (menu, payload) =>
    set((state) => ({
      menuProgress: {
        ...state.menuProgress,
        [menu]: {
          ...payload,
          progress: clampPercent(payload.progress),
        },
      },
    })),
  setCommunicationProgress: (progress) =>
    set((state) => ({
      menuProgress: {
        ...state.menuProgress,
        communication: {
          progress: clampPercent(progress),
        },
      },
    })),
  setNutritionCaloriesProgress: (consumedCalories, targetCalories) => {
    const progress =
      targetCalories > 0
        ? clampPercent((consumedCalories / targetCalories) * 100)
        : 1;

    set((state) => ({
      menuProgress: {
        ...state.menuProgress,
        nutrition: {
          progress,
        },
      },
    }));
  },
}));
