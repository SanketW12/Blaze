import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuggestedMealsHeaderActionProps {
  hasSavedSuggestedMeals: boolean;
  areAllSuggestedMealsConsumed: boolean;
  onGeneratePlan: () => void;
  onGenerateRemaining: () => void;
}

export const SuggestedMealsHeaderAction = ({
  hasSavedSuggestedMeals,
  areAllSuggestedMealsConsumed,
  onGeneratePlan,
  onGenerateRemaining
}: SuggestedMealsHeaderActionProps) => {
  if (!hasSavedSuggestedMeals) {
    return (
      <Button onClick={onGeneratePlan} size="sm" variant="secondary">
        <Sparkles className="mr-1.5 size-3" />
        Generate meal plan
      </Button>
    );
  }

  if (areAllSuggestedMealsConsumed) {
    return (
      <Button onClick={onGenerateRemaining} size="sm" variant="secondary">
        <Sparkles className="mr-1.5 size-3" />
        Generate for remaining
      </Button>
    );
  }

  return null;
};
