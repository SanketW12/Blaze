import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CommunicationSummaryCardProps {
  overallProgress: number;
  completedSections: number;
  totalSections: number;
  completedTasks: number;
  totalTasks: number;
  isRefreshing?: boolean;
  isSaving?: boolean;
  onRefresh: () => void;
}

export const CommunicationSummaryCard = ({
  overallProgress,
  completedSections,
  totalSections,
  completedTasks,
  totalTasks,
  isRefreshing = false,
  isSaving = false,
  onRefresh
}: CommunicationSummaryCardProps) => (
  <Card className="bg-muted/40 shadow-none">
    <CardContent className="space-y-4 p-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Communication Progress
          </p>
          <Button
            aria-label="Refresh communication progress"
            disabled={isRefreshing}
            onClick={onRefresh}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <RefreshCcw
              className={`size-3 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
        <p className="text-lg font-semibold">{overallProgress.toFixed(0)}% complete today</p>
        <p className="text-muted-foreground text-xs">
          {isSaving ? 'Saving progress...' : 'Progress updates as you complete practice tasks.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/60 bg-muted/55 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sections
          </p>
          <p className="mt-1 text-2xl font-bold leading-none">
            {completedSections}/{totalSections}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">completed</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/55 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tasks
          </p>
          <p className="mt-1 text-2xl font-bold leading-none">
            {completedTasks}/{totalTasks}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">done today</p>
        </div>
      </div>

      <Progress className="h-3" value={overallProgress} />
    </CardContent>
  </Card>
);
