import { useState } from 'react';
import { loadDashboardBootstrapData } from '../services/dashboardDataService';
import type { SuggestedMealItem } from '../types/dashboard';

type SetUserProfile = (value: {
  id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  activity_level: string | null;
  bmi: number | null;
  bmr: number | null;
  maintenanceCalories: { min?: number; max?: number; unit?: string; label?: string } | null;
  required_nutrients: Record<string, number>;
  must_complete_keys?: string[];
  created_at: string;
  updated_at: string;
} | null) => void;

type SetDailyLog = (value: {
  id: string;
  user_id: string;
  log_date: string;
  consumed_nutrients: Record<string, number>;
  suggested_meals: SuggestedMealItem[];
  completion_score: number;
  notes: string | null;
  nutrient_snapshot: Record<string, never>;
  created_at: string;
  updated_at: string;
} | null) => void;

type SetMeals = (value: Array<{
  id: string;
  user_id: string;
  daily_log_id: string | null;
  food_name: string;
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  source: 'text' | 'image' | 'manual';
  logged_at: string;
  created_at: string;
}>) => void;

export const useDashboardDataRefresh = ({
  setUserProfile,
  setDailyLog,
  setMeals
}: {
  setUserProfile: SetUserProfile;
  setDailyLog: SetDailyLog;
  setMeals: SetMeals;
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const bootstrapData = await loadDashboardBootstrapData(today);
      if (bootstrapData.userProfile) {
        setUserProfile(bootstrapData.userProfile);
      }
      setDailyLog(bootstrapData.dailyLog);
      setMeals(bootstrapData.meals);
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    isRefreshing,
    handleRefreshDashboardData
  };
};
