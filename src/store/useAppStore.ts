import { create } from "zustand";
import { persist } from "zustand/middleware";

type NutrientAmountMap = Record<string, number>;

interface SuggestedMealRecord {
  contains: Array<{
    item: string;
    quantity: string;
  }>;
  name: string;
  description: string;
  timetoConsume: string;
  nutrientSnapshot: NutrientAmountMap;
  isConsumed: boolean;
}

interface UserProfileRecord {
  id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  bmi: number | null;
  bmr: number | null;
  gender: string | null;
  maintenanceCalories?: {
    min?: number;
    max?: number;
    unit?: string;
    label?: string;
  } | null;
  required_nutrients: NutrientAmountMap;
  must_complete_keys?: string[];
  created_at: string;
  updated_at: string;
}

interface DailyLogRecord {
  id: string;
  user_id: string;
  log_date: string;
  consumed_nutrients: NutrientAmountMap;
  suggested_meals?: SuggestedMealRecord[];
  completion_score: number;
  notes: string | null;
  nutrient_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface MealEntryRecord {
  id: string;
  user_id: string;
  daily_log_id: string | null;
  food_name: string;
  nutrient_snapshot: NutrientAmountMap;
  quantity: number;
  unit: string;
  source: "text" | "image" | "manual";
  logged_at: string;
  created_at: string;
}

interface ChatHistoryRecord {
  id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface LoadingState {
  profile: boolean;
  dailyLog: boolean;
  meals: boolean;
  chat: boolean;
}

interface ErrorState {
  profile: string | null;
  dailyLog: string | null;
  meals: string | null;
  chat: string | null;
}

export interface AppStoreState {
  userProfile: UserProfileRecord | null;
  dailyLog: DailyLogRecord | null;
  meals: MealEntryRecord[];
  chatHistory: ChatHistoryRecord[];
  loading: LoadingState;
  errors: ErrorState;
  setUserProfile: (profile: UserProfileRecord | null) => void;
  setDailyLog: (dailyLog: DailyLogRecord | null) => void;
  setMeals: (meals: MealEntryRecord[]) => void;
  addMeal: (meal: MealEntryRecord) => void;
  setChatHistory: (messages: ChatHistoryRecord[]) => void;
  addChatMessage: (message: ChatHistoryRecord) => void;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
  setError: (key: keyof ErrorState, value: string | null) => void;
  resetTransientState: () => void;
}

const initialLoading: LoadingState = {
  profile: false,
  dailyLog: false,
  meals: false,
  chat: false,
};

const initialErrors: ErrorState = {
  profile: null,
  dailyLog: null,
  meals: null,
  chat: null,
};

const MAX_PERSISTED_CHAT_MESSAGES = 80;

const sanitizeChatHistory = (chatHistory?: ChatHistoryRecord[]) => {
  if (!Array.isArray(chatHistory)) return [];

  return chatHistory.slice(-MAX_PERSISTED_CHAT_MESSAGES).map((message) => {
    const metadataEntries =
      message.metadata && typeof message.metadata === "object"
        ? Object.entries(message.metadata).filter(([key]) => key !== "imageDataUrl")
        : [];

    return {
      ...message,
      metadata: Object.fromEntries(metadataEntries),
    };
  });
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      userProfile: null,
      dailyLog: null,
      meals: [],
      chatHistory: [],
      loading: initialLoading,
      errors: initialErrors,
      setUserProfile: (userProfile) => set({ userProfile }),
      setDailyLog: (dailyLog) => set({ dailyLog }),
      setMeals: (meals) => set({ meals }),
      addMeal: (meal) => set((state) => ({ meals: [meal, ...state.meals] })),
      setChatHistory: (chatHistory) => set({ chatHistory }),
      addChatMessage: (message) =>
        set((state) => ({ chatHistory: [...state.chatHistory, message] })),
      setLoading: (key, value) =>
        set((state) => ({ loading: { ...state.loading, [key]: value } })),
      setError: (key, value) =>
        set((state) => ({ errors: { ...state.errors, [key]: value } })),
      resetTransientState: () =>
        set({
          loading: initialLoading,
          errors: initialErrors,
        }),
    }),
    {
      name: "nutritrack-app-store-v1",
      version: 2,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as Pick<
            AppStoreState,
            "userProfile" | "dailyLog" | "meals" | "chatHistory"
          >;
        }

        const typedPersistedState = persistedState as Partial<AppStoreState>;

        return {
          userProfile: typedPersistedState.userProfile ?? null,
          dailyLog: typedPersistedState.dailyLog ?? null,
          meals: typedPersistedState.meals ?? [],
          chatHistory: sanitizeChatHistory(typedPersistedState.chatHistory),
        };
      },
      partialize: (state) => ({
        userProfile: state.userProfile,
        dailyLog: state.dailyLog,
        meals: state.meals,
        chatHistory: sanitizeChatHistory(state.chatHistory),
      }),
    },
  ),
);
