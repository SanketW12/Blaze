import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { CommunicationTaskItem } from '../types/communication';

interface CommunicationChecklistProps {
  tasks: CommunicationTaskItem[];
  isSaving?: boolean;
  actionHandlers?: Partial<
    Record<
      string,
      {
        label: string;
        loading?: boolean;
        onClick: () => void;
        generated?: boolean;
        generatedLabel?: string;
      }
    >
  >;
  onToggleTask: (taskId: string, checked: boolean) => void;
}

export const CommunicationChecklist = ({
  tasks,
  isSaving = false,
  actionHandlers,
  onToggleTask
}: CommunicationChecklistProps) => (
  <div className="space-y-3">
    {tasks.map(task => {
      const actionHandler = actionHandlers?.[task.id];

      if (task.type === 'ai_action') {
        return (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
            key={task.id}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{task.label}</p>
              {task.description ? (
                <p className="text-muted-foreground text-xs">{task.description}</p>
              ) : null}
            </div>
            {actionHandler?.generated ? (
              <Badge variant="outline">
                {actionHandler.generatedLabel ?? 'Generated'}
              </Badge>
            ) : (
              <Button
                disabled={actionHandler?.loading}
                onClick={actionHandler?.onClick}
                size="xs"
                type="button"
                variant="outline"
              >
                {actionHandler?.loading ? 'Loading...' : actionHandler?.label ?? 'Run'}
              </Button>
            )}
          </div>
        );
      }

      return (
        <label
          className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
          key={task.id}
        >
          <Checkbox
            checked={task.isDone}
            disabled={isSaving}
            onCheckedChange={checked => {
              onToggleTask(task.id, checked === true);
            }}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">{task.label}</p>
            {task.description ? (
              <p className="text-muted-foreground text-xs">{task.description}</p>
            ) : null}
          </div>
        </label>
      );
    })}
  </div>
);
