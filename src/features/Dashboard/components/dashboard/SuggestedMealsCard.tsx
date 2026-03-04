import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { formatAmount, normalizeMealContains } from '../../utils/formatters';
import type { NutrientDefinition, NutrientUnit, SuggestedMealItem } from '../../types/dashboard';
import { SuggestedMealsHeaderAction } from './SuggestedMealsHeaderAction';

interface SuggestedMealsCardProps {
  suggestedMealsFromLog: SuggestedMealItem[];
  hasSavedSuggestedMeals: boolean;
  areAllSuggestedMealsConsumed: boolean;
  consumingMealKey: string | null;
  deletingMealKey: string | null;
  mustCompleteRankByKey: Record<string, number>;
  nutrientDefinitionByKey: Record<string, NutrientDefinition>;
  planError: string | null;
  onGeneratePlan: () => void;
  onGenerateRemaining: () => void;
  onConsumeSuggestedMeal: (meal: SuggestedMealItem, index: number) => void;
  onOpenReplaceMealModal: (index: number) => void;
  onDeleteSuggestedMeal: (meal: SuggestedMealItem, index: number) => void;
}

export const SuggestedMealsCard = ({
  suggestedMealsFromLog,
  hasSavedSuggestedMeals,
  areAllSuggestedMealsConsumed,
  consumingMealKey,
  deletingMealKey,
  mustCompleteRankByKey,
  nutrientDefinitionByKey,
  planError,
  onGeneratePlan,
  onGenerateRemaining,
  onConsumeSuggestedMeal,
  onOpenReplaceMealModal,
  onDeleteSuggestedMeal
}: SuggestedMealsCardProps) => (
  <Card className="bg-muted/25 shadow-none py-5">
    <CardHeader className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Suggested Meals Plan</CardTitle>
        <SuggestedMealsHeaderAction
          areAllSuggestedMealsConsumed={areAllSuggestedMealsConsumed}
          hasSavedSuggestedMeals={hasSavedSuggestedMeals}
          onGeneratePlan={onGeneratePlan}
          onGenerateRemaining={onGenerateRemaining}
        />
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      {suggestedMealsFromLog.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No suggested meal plan yet. Generate one to plan your day.
        </p>
      ) : (
        <Accordion className="rounded-lg border border-border/60 bg-card/70 px-3">
          {suggestedMealsFromLog.map((meal, index) => {
            const containsList = normalizeMealContains(
              meal.contains,
              (meal as unknown as { quantity?: unknown }).quantity
            );
            const mealKey = `${meal.name}-${meal.timetoConsume}-${index}`;
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
              <AccordionItem className="border-border/60" key={mealKey} value={mealKey}>
                <AccordionTrigger className="items-center py-3 max-w-full  ">
                  <div className="flex w-full min-w-0 items-start gap-2">
                    <div
                      className="shrink-0 pt-1"
                      onClick={event => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={meal.isConsumed}
                        disabled={
                          meal.isConsumed ||
                          consumingMealKey === mealKey ||
                          deletingMealKey === mealKey
                        }
                        onCheckedChange={checked => {
                          if (checked === true) {
                            onConsumeSuggestedMeal(meal, index);
                          }
                        }}
                      />
                    </div>
                    <div className="w-full">
                      <p className="block max-w-[90%] overflow-hidden text-ellipsis whitespace-nowrap  font-medium">
                        {meal.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {meal.timetoConsume} •{' '}
                        {Number(meal.nutrientSnapshot.calories ?? 0).toFixed(0)}kcal
                        {meal.isConsumed
                          ? ' • Consumed'
                          : consumingMealKey === mealKey
                            ? ' • Saving...'
                            : ''}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                      <p className="flex wrap-break-word font-medium">
                        {meal.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {meal.description?.trim() || 'No meal description available yet.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Contains:</p>
                      {containsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground">NA</p>
                      ) : (
                        <div className="space-y-1">
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
                    </div>
                    {!meal.isConsumed ? (
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={deletingMealKey === mealKey || consumingMealKey === mealKey}
                          onClick={() => onOpenReplaceMealModal(index)}
                          size="xs"
                          type="button"
                          variant="outline"
                        >
                          Replace
                        </Button>
                        <Button
                          disabled={deletingMealKey === mealKey || consumingMealKey === mealKey}
                          onClick={() => onDeleteSuggestedMeal(meal, index)}
                          size="xs"
                          type="button"
                          variant="destructive"
                        >
                          {deletingMealKey === mealKey ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    ) : null}

                  </div>

                  {mealNutrients.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No nutrient details available.</p>
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
      )}
      {planError ? <p className="text-sm text-destructive">{planError}</p> : null}
    </CardContent>
  </Card>
);
