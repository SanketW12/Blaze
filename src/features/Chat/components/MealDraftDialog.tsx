import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import type { MealDraft } from '../types/chat';

interface MealDraftDialogProps {
  mealDraft: MealDraft | null;
  isAddingMeal: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onAdd: () => void;
}

export const MealDraftDialog = ({
  mealDraft,
  isAddingMeal,
  onOpenChange,
  onCancel,
  onAdd
}: MealDraftDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={Boolean(mealDraft)}>
    <DialogContent className="sm:max-w-md border-none shadow-none">
      <DialogPanel className="space-y-3">
        <DialogTitle>Meal Preview</DialogTitle>
        {mealDraft ? (
          <div className="space-y-2 text-sm">
            <div className="rounded-md border border-border/60 px-3 py-2">
              <p className="font-medium">{mealDraft.food_name}</p>
              <p className="text-muted-foreground">
                {mealDraft.quantity} {mealDraft.unit} • {mealDraft.source}
              </p>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
              {Object.entries(mealDraft.nutrient_snapshot)
                .filter(([, value]) => Number(value) > 0)
                .map(([key, value]) => (
                  <div className="flex items-center justify-between" key={key}>
                    <span className="text-muted-foreground">{key}</span>
                    <span>{Number(value).toFixed(2)}</span>
                  </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={onCancel} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isAddingMeal} onClick={onAdd} type="button">
                {isAddingMeal ? 'Adding...' : 'Add to Today Meals'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogPanel>
    </DialogContent>
  </Dialog>
);
