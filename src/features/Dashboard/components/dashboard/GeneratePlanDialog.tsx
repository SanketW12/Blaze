import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogPanel,
  DialogTitle
} from '@/components/ui/dialog';
import { formatAmount, normalizeMealContains } from '../../utils/formatters';
import type { NutrientDefinition, SuggestedMealItem, NutrientUnit } from '../../types/dashboard';

interface GeneratePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planPrompt: string;
  onPlanPromptChange: (value: string) => void;
  isGeneratingPlan: boolean;
  onGenerate: () => void;
  generatedPlanDraft: SuggestedMealItem[] | null;
  isSavingPlan: boolean;
  onSave: () => void;
  planError: string | null;
  mustCompleteRankByKey: Record<string, number>;
  nutrientDefinitionByKey: Record<string, NutrientDefinition>;
}

export const GeneratePlanDialog = ({
  open,
  onOpenChange,
  planPrompt,
  onPlanPromptChange,
  isGeneratingPlan,
  onGenerate,
  generatedPlanDraft,
  isSavingPlan,
  onSave,
  planError,
  mustCompleteRankByKey,
  nutrientDefinitionByKey
}: GeneratePlanDialogProps) => {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="before:hidden sm:max-w-lg border-none shadow-lg">
        <DialogPanel className="space-y-4 ">
          <DialogTitle>Generate Suggested Meal Plan</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add optional preferences, then generate an AI plan for the day.
          </p>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none ring-ring/30 focus:ring-2"
            onChange={event => onPlanPromptChange(event.target.value)}
            placeholder="Optional notes (e.g., vegetarian, no dairy, high protein breakfast)"
            value={planPrompt}
          />

          <Button className="w-full" disabled={isGeneratingPlan} onClick={onGenerate} type="button">
            {isGeneratingPlan ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating plan...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Generate
              </>
            )}
          </Button>

          {generatedPlanDraft ? (
            <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 p-2">
                <Accordion className="rounded-md border border-border/40 bg-card/70 px-3">
                  {generatedPlanDraft.map((meal, index) => {
                    const containsList = normalizeMealContains(meal.contains);
                    const mealNutrients = Object.entries(meal.nutrientSnapshot ?? {})
                      .filter(([, value]) => Number(value) > 0)
                      .sort(([keyA, valueA], [keyB, valueB]) => {
                        const rankA = mustCompleteRankByKey[keyA];
                        const rankB = mustCompleteRankByKey[keyB];
                        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                        if (rankA !== undefined) return -1;
                        if (rankB !== undefined) return 1;
                        return Number(valueB) - Number(valueA);
                      });

                    return (
                      <AccordionItem
                        className="border-border/60"
                        key={`${meal.name}-${meal.timetoConsume}-${index}`}
                        value={`${meal.name}-${meal.timetoConsume}-${index}`}
                      >
                        <AccordionTrigger className="items-center py-3">
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                                {meal.name}
                              </p>
                              <p className="line-clamp-2 text-left text-xs text-muted-foreground">
                                {meal.description?.trim() || 'No meal description available yet.'}
                              </p>
                              <p className="text-xs text-muted-foreground">{meal.timetoConsume}</p>
                            </div>
                            <p className="shrink-0 text-xs text-muted-foreground">
                              {Number(meal.nutrientSnapshot.calories ?? 0).toFixed(0)}kcal
                            </p>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3">
                          <p className="text-xs text-muted-foreground">
                            Contains:
                          </p>
                          {containsList.length === 0 ? (
                            <p className="mb-2 text-xs text-muted-foreground">NA</p>
                          ) : (
                            <div className="mb-2 space-y-1">
                              {containsList.map((item, itemIndex) => (
                                <p
                                  className="text-xs text-muted-foreground"
                                  key={`${item.item}-${item.quantity}-${itemIndex}`}
                                >
                                  {item.item} - {item.quantity}
                                </p>
                              ))}
                            </div>
                          )}
                          {mealNutrients.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No nutrient details available.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {mealNutrients.map(([key, value]) => {
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
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              <Button className="w-full" disabled={isSavingPlan} onClick={onSave} type="button" variant="secondary">
                {isSavingPlan ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving plan...
                  </>
                ) : (
                  'Save meal plan'
                )}
              </Button>
            </div>
          ) : null}

          {planError ? <p className="text-sm text-destructive">{planError}</p> : null}
        </DialogPanel>
      </DialogContent>
    </Dialog>
  );
};
