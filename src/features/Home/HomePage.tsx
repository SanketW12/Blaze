import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Speech, Sprout } from 'lucide-react';
import { Card, CardContent, } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/store';
import { CommunicationStreakCard } from '@/features/Communication/components/CommunicationStreakCard';
import { communicationDataService } from '@/features/Communication/services/communicationDataService';
import { DISCIPLINE_STREAK_REQUIRED_TAPS } from './constants/home';
import { disciplineStreakService } from './services/disciplineStreakService';
import { useHomeStore } from './store';
import type { DisciplineStreakState } from './types/disciplineStreak';
import { buildEmptyDisciplineStreakState } from './utils/disciplineStreak';

interface HomePageProps {
  onOpenNutrition?: () => void;
  onOpenCommunication?: () => void;
  onOpenDiscipline?: () => void;
  onOpenSkills?: () => void;
}



interface NavigationMenuProps {
  key: 'learning' | 'nutrition' | 'skills' | 'communication';
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  progress: number;
}

const HomePage = ({
  onOpenNutrition,
  onOpenCommunication,
  onOpenDiscipline,
  onOpenSkills: _onOpenSkills
}: HomePageProps) => {
  const dailyLog = useAppStore(state => state.dailyLog);
  const userProfile = useAppStore(state => state.userProfile);
  const communicationProgress = useHomeStore(state => state.menuProgress.communication);
  const nutritionProgress = useHomeStore(state => state.menuProgress.nutrition);
  const setCommunicationProgress = useHomeStore(state => state.setCommunicationProgress);
  const setNutritionCaloriesProgress = useHomeStore(state => state.setNutritionCaloriesProgress);
  const [disciplineStreak, setDisciplineStreak] = useState<DisciplineStreakState>(
    buildEmptyDisciplineStreakState()
  );
  const [isUpdatingDisciplineStreak, setIsUpdatingDisciplineStreak] = useState(false);
  const [disciplineCardClickCount, setDisciplineCardClickCount] = useState(0);
  const [disciplineTapCount, setDisciplineTapCount] = useState(0);
  const disciplineTapResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const consumedCalories = Number(dailyLog?.consumed_nutrients?.calories ?? 0);
    const targetCalories = Number(userProfile?.required_nutrients?.calories ?? 0);
    setNutritionCaloriesProgress(consumedCalories, targetCalories);
  }, [dailyLog?.consumed_nutrients?.calories, setNutritionCaloriesProgress, userProfile?.required_nutrients?.calories]);

  useEffect(() => {
    let isActive = true;

    const loadHomeProgress = async () => {
      try {
        const [communicationLog, manualDisciplineStreak] = await Promise.all([
          communicationDataService.getTodayCommunicationLog(),
          disciplineStreakService.getDisciplineStreak()
        ]);
        if (!isActive) return;

        setCommunicationProgress(communicationLog?.overallProgress ?? 1);
        setDisciplineStreak(manualDisciplineStreak);
      } catch {
        if (!isActive) return;
        setCommunicationProgress(1);
        setDisciplineStreak(buildEmptyDisciplineStreakState());
      }
    };

    void loadHomeProgress();

    return () => {
      isActive = false;
    };
  }, [setCommunicationProgress]);

  useEffect(() => () => {
    if (disciplineTapResetTimeoutRef.current) {
      clearTimeout(disciplineTapResetTimeoutRef.current);
    }
  }, []);

  const handleTodayDisciplineTap = useCallback(async () => {
    const isTodayCompleted = disciplineStreak.weekDays.some(day => day.isToday && day.active);

    if (isTodayCompleted || isUpdatingDisciplineStreak) {
      return;
    }

    if (disciplineTapResetTimeoutRef.current) {
      clearTimeout(disciplineTapResetTimeoutRef.current);
    }

    const nextTapCount = disciplineTapCount + 1;

    if (nextTapCount < DISCIPLINE_STREAK_REQUIRED_TAPS) {
      setDisciplineTapCount(nextTapCount);
      disciplineTapResetTimeoutRef.current = setTimeout(() => {
        setDisciplineTapCount(0);
      }, 1500);
      return;
    }

    try {
      setIsUpdatingDisciplineStreak(true);
      setDisciplineTapCount(0);
      const nextStreak = await disciplineStreakService.completeToday();
      setDisciplineStreak(nextStreak);
    } finally {
      setIsUpdatingDisciplineStreak(false);
    }
  }, [disciplineStreak.weekDays, disciplineTapCount, isUpdatingDisciplineStreak]);

  const handleDisciplineCardClick = useCallback(() => {
    const nextCount = disciplineCardClickCount + 1;
    if (nextCount >= 5) {
      setDisciplineCardClickCount(0);
      onOpenDiscipline?.();
      return;
    }

    setDisciplineCardClickCount(nextCount);
  }, [disciplineCardClickCount, onOpenDiscipline]);

  const navigationMenu: NavigationMenuProps[] = useMemo(
    () => [
      {
        key: 'communication',
        label: 'Communication',
        icon: <Speech className="size-4" />,
        onClick: onOpenCommunication || (() => { }),
        progress: communicationProgress.progress
      }, {
        key: 'nutrition',
        label: 'Nutrition',
        icon: <Sprout className="size-4" />,
        onClick: onOpenNutrition || (() => { }),
        progress: nutritionProgress.progress
      },
    ],
    [
      communicationProgress.progress,
      onOpenCommunication,
      nutritionProgress.progress,
      onOpenNutrition,
    ]
  );

  return (
    <main className=" bg-card text-foreground pb-24">
      <section className="mx-auto w-full max-w-lg  space-y-4">
        <CommunicationStreakCard
          currentStreak={disciplineStreak.currentStreakDays}
          longestStreak={disciplineStreak.longestStreakDays}
          subtitle="Stay consistent across your daily practice"
          title="Discipline Streak"
          onCurrentStreakClick={handleDisciplineCardClick}
          todayTapProgress={{
            current: disciplineTapCount,
            required: DISCIPLINE_STREAK_REQUIRED_TAPS,
            completed: disciplineStreak.weekDays.some(day => day.isToday && day.active),
            isSaving: isUpdatingDisciplineStreak,
            onClick: handleTodayDisciplineTap
          }}
          totalPracticeDays={disciplineStreak.totalQualifiedDays}
          weekDays={disciplineStreak.weekDays}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Today&apos;s Progress
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {navigationMenu.map(item => (
            <Card className="bg-muted/40 shadow-none"
              key={item.key}
              onClick={item.onClick}
            >
              <CardContent className="space-y-4 p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                    <Button
                      className=" z-40 rounded-full shadow-md hover:-rotate-45"
                      aria-label="arrow right"
                      onClick={item.onClick}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowRight className={`size-4  `} />
                    </Button>
                  </div>

                  <Progress className="h-2" value={item.progress} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
};

export default HomePage;
