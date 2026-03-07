import { Check, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface StreakDayItem {
  label: string;
  active: boolean;
}

interface CommunicationStreakCardProps {
  currentStreak: number;
  longestStreak: number;
  totalPracticeDays: number;
  weekDays: StreakDayItem[];
}

export const CommunicationStreakCard = ({
  currentStreak,
  longestStreak,
  totalPracticeDays,
  weekDays
}: CommunicationStreakCardProps) => (
  <Card className="bg-muted/25 shadow-none">
    <CardContent className="space-y-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <Zap className="size-4 fill-current" />
          </div>
          <div>
            <p className="text-lg font-semibold">Current Streak</p>
            <p className="text-muted-foreground text-xs">Keep your practice going daily</p>
          </div>
        </div>
        <p className="text-2xl font-bold">{currentStreak} days</p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => (
          <div className="flex flex-col items-center gap-2" key={day.label}>
            <div
              className={`flex size-10 items-center justify-center rounded-full border ${
                day.active
                  ? 'border-emerald-500/40 bg-emerald-500 text-white'
                  : 'border-border/60 bg-muted text-muted-foreground'
              }`}
            >
              {day.active ? <Check className="size-5" /> : null}
            </div>
            <span
              className={`text-xs font-semibold ${
                day.active ? 'text-emerald-500' : 'text-muted-foreground'
              }`}
            >
              {day.label}
            </span>
          </div>
        ))}
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
