import { useEffect, useMemo, useRef } from 'react';
import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface StreakWeekDayItem {
  label: string;
  active: boolean;
  isToday?: boolean;
}

interface StreakMonthDayItem {
  date: string;
  dayOfMonth: number;
  weekDayLabel: string;
  active: boolean;
  isToday?: boolean;
  isFuture?: boolean;
}

interface CommunicationStreakCardProps {
  currentStreak: number;
  longestStreak: number;
  totalPracticeDays: number;
  weekDays: StreakWeekDayItem[];
  title?: string;
  subtitle?: string;
  onCurrentStreakClick?: () => void;
  todayTapProgress?: {
    current: number;
    required: number;
    completed?: boolean;
    isSaving?: boolean;
    onClick?: () => void;
  };
  monthDays?: StreakMonthDayItem[];
  onMonthDayToggle?: (date: string, nextActive: boolean) => void;
  savingMonthDate?: string | null;
}

export const CommunicationStreakCard = ({
  currentStreak,
  longestStreak,
  totalPracticeDays,
  weekDays,
  title = 'Current Streak',
  subtitle = 'Keep your practice going daily',
  onCurrentStreakClick,
  todayTapProgress,
  monthDays,
  onMonthDayToggle,
  savingMonthDate
}: CommunicationStreakCardProps) => {
  const displayDays = useMemo(
    () =>
      monthDays && monthDays.length > 0
        ? monthDays.map((day, index) => ({
            key: day.date || `month-${index}`,
            date: day.date,
            label: day.weekDayLabel,
            active: day.active,
            isToday: Boolean(day.isToday),
            isFuture: Boolean(day.isFuture),
            dayOfMonth: day.dayOfMonth
          }))
        : weekDays.map((day, index) => ({
            key: `week-${index}-${day.label}`,
            date: null as string | null,
            label: day.label,
            active: day.active,
            isToday: Boolean(day.isToday),
            isFuture: false,
            dayOfMonth: null as number | null
          })),
    [monthDays, weekDays]
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeDayRef = useRef<HTMLDivElement | null>(null);

  const activeDayIndex = useMemo(() => {
    const todayIndex = displayDays.findIndex(day => day.isToday);
    if (todayIndex >= 0) return todayIndex;

    for (let index = displayDays.length - 1; index >= 0; index -= 1) {
      if (displayDays[index].active) {
        return index;
      }
    }

    return 0;
  }, [displayDays]);

  useEffect(() => {
    if (!scrollContainerRef.current || !activeDayRef.current) return;

    const frame = requestAnimationFrame(() => {
      activeDayRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'center'
      });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [activeDayIndex, displayDays.length]);

  return (
    <Card className="bg-muted/25 shadow-none">
      <CardContent className="space-y-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <Zap className="size-4 fill-current" />
            </div>
            <div>
              <p className="text-lg font-semibold">{title}</p>
              <p className="text-muted-foreground text-xs">{subtitle}</p>
            </div>
          </div>
          <button
            className={cn(
              'bg-transparent p-0 text-2xl font-bold',
              onCurrentStreakClick ? 'cursor-pointer' : undefined
            )}
            onClick={onCurrentStreakClick}
            type="button"
          >
            {currentStreak} days
          </button>
        </div>

        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <div className="flex min-w-max gap-2 pb-1">
            {displayDays.map((day, index) => {
              const isSaving = day.date ? savingMonthDate === day.date : false;
              const canToggle =
                Boolean(onMonthDayToggle) &&
                Boolean(day.date) &&
                !day.isFuture &&
                !day.isToday &&
                !isSaving;

              const label = day.label ?? '';

              const content = (
                <>
                  <div
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                      day.active
                        ? 'border-emerald-500/40 bg-emerald-500 text-white'
                        : day.isToday
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                          : 'border-border/60 bg-muted text-muted-foreground'
                    )}
                  >
                    {day.active ? <Check className="size-5" /> : day.dayOfMonth ?? null}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      day.active ? 'text-emerald-500' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                </>
              );

              if (day.isToday && todayTapProgress?.onClick && !day.active) {
                return (
                  <div
                    className="flex flex-col items-center gap-2"
                    key={day.key}
                    ref={index === activeDayIndex ? activeDayRef : null}
                  >
                    <button
                      aria-label="Mark today's discipline streak"
                      className="flex flex-col items-center gap-2"
                      disabled={todayTapProgress.isSaving}
                      onClick={event => {
                        event.stopPropagation();
                        todayTapProgress.onClick?.();
                      }}
                      type="button"
                    >
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-full border transition-colors',
                          'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15',
                          todayTapProgress.isSaving
                            ? 'pointer-events-none opacity-60'
                            : 'cursor-pointer'
                        )}
                      />
                      <span className="text-xs font-semibold text-amber-400">{label}</span>
                    </button>
                  </div>
                );
              }

              if (canToggle) {
                return (
                  <div
                    className="flex flex-col items-center gap-2"
                    key={day.key}
                    ref={index === activeDayIndex ? activeDayRef : null}
                  >
                    <button
                      className="flex cursor-pointer flex-col items-center gap-2"
                      onClick={() => {
                        if (!day.date) return;
                        onMonthDayToggle?.(day.date, !day.active);
                      }}
                      type="button"
                    >
                      {content}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  className="flex flex-col items-center gap-2"
                  key={day.key}
                  ref={index === activeDayIndex ? activeDayRef : null}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="border-dashed" />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Longest Streak
            </p>
            <p className="text-2xl font-bold">{longestStreak} days</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Total Practice Days
            </p>
            <p className="text-2xl font-bold">{totalPracticeDays}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
