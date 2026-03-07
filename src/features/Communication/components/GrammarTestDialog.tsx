import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { GrammarQuestionItem } from '../types/communication';

interface GrammarTestDialogProps {
  answers: Record<string, string>;
  isGeneratingExercises?: boolean;
  onAnswerChange: (questionId: string, answer: string) => void;
  onGenerateExercises: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questions: GrammarQuestionItem[];
}

export const GrammarTestDialog = ({
  answers,
  isGeneratingExercises = false,
  onAnswerChange,
  onGenerateExercises,
  onOpenChange,
  open,
  questions
}: GrammarTestDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Grammar Test</DialogTitle>
        <DialogDescription>
          Answer the questions, then generate personalized grammar exercises.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-4">
        {questions.map((question, index) => (
          <div className="space-y-2" key={question.id}>
            <p className="text-sm font-medium">
              {index + 1}. {question.prompt}
            </p>
            <Textarea
              onChange={event => {
                onAnswerChange(question.id, event.target.value);
              }}
              placeholder="Write your answer"
              value={answers[question.id] ?? ''}
            />
          </div>
        ))}
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={isGeneratingExercises || questions.length === 0}
          onClick={onGenerateExercises}
          size="xs"
          type="button"
        >
          {isGeneratingExercises ? 'Generating...' : 'Generate grammar exercises'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
