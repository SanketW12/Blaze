import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';

import { firebaseDataService } from '@/firebase';
import { useAppStore } from '@/store';
import { ToastProvider } from '@/shared/contexts/ToastContext';
import { ThemeProvider } from '@/shared/contexts/ThemeProvider';
import { queryClient } from '@/shared/lib/QueryClient';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  const setUserProfile = useAppStore(state => state.setUserProfile);
  const setDailyLog = useAppStore(state => state.setDailyLog);
  const setMeals = useAppStore(state => state.setMeals);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrapData = async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;

      const [profile, todayLog] = await Promise.all([
        firebaseDataService.getUserProfile(),
        firebaseDataService.getDailyLog(today)
      ]);

      const dailyLog = todayLog ?? (await firebaseDataService.getLatestDailyLog());
      const activeLogDate =
        (dailyLog as Record<string, unknown> | null)?.date?.toString() ?? today;
      const mealsForActiveDate = await firebaseDataService.listMealsForDate(activeLogDate);

      if (cancelled) return;

      if (profile) {
        const rawProfile = profile as unknown as Record<string, unknown>;
        setUserProfile({
          id: 'profile',
          user_id: 'sanket',
          name: (rawProfile.name as string | null) ?? null,
          age: (rawProfile.age as number | null) ?? null,
          gender: (rawProfile.gender as string | null) ?? null,
          weight_kg: (rawProfile.weightKg as number | null) ?? null,
          height_cm: (rawProfile.heightCm as number | null) ?? null,
          activity_level: (rawProfile.activityLevel as string | null) ?? null,
          bmi: (rawProfile.bmi as number | null) ?? null,
          bmr: (rawProfile.bmr as number | null) ?? null,
          maintenanceCalories:
            (rawProfile.maintenanceCalories as
              | { min?: number; max?: number; unit?: string; label?: string }
              | undefined) ?? null,
          required_nutrients: (rawProfile.requiredNutrients as Record<string, number> | undefined) ?? {},
          must_complete_keys: (rawProfile.mustCompleteKeys as string[] | undefined) ?? undefined,
          created_at: '',
          updated_at: new Date().toISOString()
        });
      }

      if (dailyLog) {
        const rawDailyLog = dailyLog as unknown as Record<string, unknown>;
        setDailyLog({
          id: today,
          user_id: 'sanket',
          log_date: (rawDailyLog.date as string | undefined) ?? today,
          consumed_nutrients: (rawDailyLog.consumedNutrients as Record<string, number> | undefined) ?? {},
          completion_score: 0,
          notes: (rawDailyLog.notes as string | null | undefined) ?? null,
          nutrient_snapshot: {},
          created_at: '',
          updated_at: new Date().toISOString()
        });
      } else {
        // Ensure stale persisted daily data is cleared when no log exists for today.
        setDailyLog(null);
      }

      setMeals(
        mealsForActiveDate.map(meal => ({
          id: meal.id,
          user_id: 'sanket',
          daily_log_id:
            ((dailyLog as Record<string, unknown> | null)?.id as string | null) ??
            null,
          food_name: meal.name,
          nutrient_snapshot: meal.nutrientSnapshot,
          quantity: meal.quantity,
          unit: meal.unit,
          source: meal.source,
          logged_at: meal.loggedAt,
          created_at:
            typeof meal.createdAt === 'string'
              ? meal.createdAt
              : new Date().toISOString()
        }))
      );
    };

    void loadBootstrapData();

    return () => {
      cancelled = true;
    };
  }, [setDailyLog, setMeals, setUserProfile]);

  return (
    <ThemeProvider
      defaultTheme="dark"
      forcedTheme="dark"
      storageKey="theme-preference-dark-only"
    >
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
