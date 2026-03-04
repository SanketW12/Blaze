import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogPanel,
  DialogTitle
} from '@/components/ui/dialog';
import { formatAmount } from '../../utils/formatters';
import type {
  NutrientDefinition,
  NutrientUnit,
  SuggestedMealContainItem,
  SuggestedMealItem
} from '../../types/dashboard';

interface ReplaceMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replaceInstructions: string;
  onReplaceInstructionsChange: (value: string) => void;
  isGeneratingReplacement: boolean;
  onGenerateReplacement: () => void;
  replacementDraft: SuggestedMealItem | null;
  replacementContainsList: SuggestedMealContainItem[];
  mustCompleteRankByKey: Record<string, number>;
  nutrientDefinitionByKey: Record<string, NutrientDefinition>;
  isSavingReplacement: boolean;
  onSaveReplacement: () => void;
  replaceError: string | null;
}

export const ReplaceMealDialog = ({
  open,
  onOpenChange,
  replaceInstructions,
  onReplaceInstructionsChange,
  isGeneratingReplacement,
  onGenerateReplacement,
  replacementDraft,
  replacementContainsList,
  mustCompleteRankByKey,
  nutrientDefinitionByKey,
  isSavingReplacement,
  onSaveReplacement,
  replaceError
}: ReplaceMealDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="before:hidden sm:max-w-lg border-none shadow-lg">
      <DialogPanel className="space-y-4 ">
        <DialogTitle>Replace Suggested Meal</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Add optional instructions for the replacement meal. Time slot stays the same.
        </p>

        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none ring-ring/30 focus:ring-2"
          onChange={event => onReplaceInstructionsChange(event.target.value)}
          placeholder="Optional notes (e.g., lower calories, vegetarian, no dairy)"
          value={replaceInstructions}
        />

        <Button
          className="w-full"
          disabled={isGeneratingReplacement}
          onClick={onGenerateReplacement}
          type="button"
        >
          {isGeneratingReplacement ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating replacement...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate replacement
            </>
          )}
        </Button>

        {replacementDraft ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border/60 p-3">
              <p className="font-medium">{replacementDraft.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {replacementDraft.description}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Contains:
              </p>
              {replacementContainsList.length === 0 ? (
                <p className="text-xs text-muted-foreground">NA</p>
              ) : (
                <div className="space-y-1">
                  {replacementContainsList.map((item, itemIndex) => (
                    <p
                      className="text-xs text-muted-foreground"
                      key={`${item.item}-${item.quantity}-${itemIndex}`}
                    >
                      {item.item} - {item.quantity}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{replacementDraft.timetoConsume}</p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {Object.entries(replacementDraft.nutrientSnapshot)
                  .filter(([, value]) => Number(value) > 0)
                  .sort(([keyA, valueA], [keyB, valueB]) => {
                    const rankA = mustCompleteRankByKey[keyA];
                    const rankB = mustCompleteRankByKey[keyB];
                    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                    if (rankA !== undefined) return -1;
                    if (rankB !== undefined) return 1;
                    return Number(valueB) - Number(valueA);
                  })
                  .map(([key, value]) => {
                    const definition = nutrientDefinitionByKey[key];
                    const unit = definition?.unit ?? '';
                    const label = definition?.label ?? key.replaceAll('_', ' ');
                    return (
                      <div className="flex items-center justify-between text-xs" key={key}>
                        <p className="capitalize text-muted-foreground">{label}</p>
                        <p className="font-medium">
                          {formatAmount(Number(value), unit as NutrientUnit)}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={isSavingReplacement}
              onClick={onSaveReplacement}
              type="button"
              variant="secondary"
            >
              {isSavingReplacement ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving replacement...
                </>
              ) : (
                'Save replacement'
              )}
            </Button>
          </div>
        ) : null}

        {replaceError ? <p className="text-sm text-destructive">{replaceError}</p> : null}
      </DialogPanel>
    </DialogContent>
  </Dialog>
);
