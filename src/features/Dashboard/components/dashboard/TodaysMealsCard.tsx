import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { formatAmount } from '../../utils/formatters';
import type { NutrientDefinition, NutrientUnit } from '../../types/dashboard';

interface TodaysMealsCardProps {
  todaysMeals: Array<{
    id: string;
    food_name: string;
    quantity: number;
    unit: string;
    nutrient_snapshot: Record<string, number>;
  }>;
  mustCompleteRankByKey: Record<string, number>;
  nutrientDefinitionByKey: Record<string, NutrientDefinition>;
}

export const TodaysMealsCard = ({
  todaysMeals,
  mustCompleteRankByKey,
  nutrientDefinitionByKey
}: TodaysMealsCardProps) => (
  <Card className="bg-muted/25 shadow-none py-5">
    <CardHeader>
      <CardTitle>Today&apos;s Meals ({todaysMeals.length})</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      {todaysMeals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meals logged yet.</p>
      ) : (
        <Accordion className="rounded-lg border border-border/60 bg-card/70 px-3">
          {todaysMeals.map(meal => {
            const mealNutrients = Object.entries(meal.nutrient_snapshot ?? {})
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
              <AccordionItem className="border-border/60" key={meal.id} value={meal.id}>
                <AccordionTrigger className="items-center py-3">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{meal.food_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {meal.quantity} {meal.unit}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {Number(meal.nutrient_snapshot.calories ?? 0).toFixed(0)}kcal
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
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
    </CardContent>
  </Card>
);
