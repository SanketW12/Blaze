import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { COMMUNICATION_ARTICLE_SOURCES } from '../constants/communication';
import type {
  CommunicationAiContent,
  CommunicationArticlePractice,
  CommunicationSectionItem
} from '../types/communication';
import { AiPracticeResultCard } from './AiPracticeResultCard';
import { CommunicationChecklist } from './CommunicationChecklist';
import { PracticeInfoPopover } from './PracticeInfoPopover';

interface ArticlePracticeCardProps {
  articlePractice: CommunicationArticlePractice;
  articleReflection?: CommunicationAiContent;
  section: CommunicationSectionItem;
  isLoadingReflection?: boolean;
  isSaving?: boolean;
  onGenerateReflection: () => void;
  onToggleTask: (taskId: string, checked: boolean) => void;
  onUpdateArticlePractice: (patch: Partial<CommunicationArticlePractice>) => void;
}

export const ArticlePracticeCard = ({
  articlePractice,
  articleReflection,
  section,
  isLoadingReflection = false,
  isSaving = false,
  onGenerateReflection,
  onToggleTask,
  onUpdateArticlePractice
}: ArticlePracticeCardProps) => (
  <Card className="bg-muted/25 shadow-none">
    <CardContent className="p-4">
      <Accordion defaultValue={[section.key]} multiple>
        <AccordionItem className="border-none" value={section.key}>
          <AccordionTrigger className="py-0">
            <div className="w-full space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{section.label}</p>
                    <PracticeInfoPopover section={section} />
                  </div>
                  <p className="text-muted-foreground text-xs">{section.description}</p>
                </div>
                <p className="text-muted-foreground text-xs font-semibold whitespace-nowrap">
                  {section.progress.toFixed(0)} / 100%
                </p>
              </div>

              <Progress className="h-2.5" value={section.progress} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {COMMUNICATION_ARTICLE_SOURCES.map(source => (
                  <Button
                    key={source.value}
                    onClick={() => {
                      void onUpdateArticlePractice({ source: source.value });
                    }}
                    size="xs"
                    type="button"
                    variant={articlePractice.source === source.value ? 'secondary' : 'outline'}
                  >
                    {source.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3">
                <Input
                  onChange={event => {
                    void onUpdateArticlePractice({ articleTitle: event.target.value });
                  }}
                  placeholder="Article title"
                  value={articlePractice.articleTitle}
                />
                <Input
                  onChange={event => {
                    void onUpdateArticlePractice({ articleUrl: event.target.value });
                  }}
                  placeholder="Article URL (optional)"
                  value={articlePractice.articleUrl}
                />
                <Textarea
                  onChange={event => {
                    void onUpdateArticlePractice({ notes: event.target.value });
                  }}
                  placeholder="Write short key points or summary notes"
                  value={articlePractice.notes}
                />
                <Textarea
                  onChange={event => {
                    void onUpdateArticlePractice({ selfReviewNotes: event.target.value });
                  }}
                  placeholder="Self review: clarity, structure, and tone"
                  value={articlePractice.selfReviewNotes}
                />
              </div>

              <CommunicationChecklist
                isSaving={isSaving}
                onToggleTask={onToggleTask}
                tasks={section.tasks}
              />

              {!articleReflection ? (
                <Button
                  disabled={isLoadingReflection}
                  onClick={onGenerateReflection}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {isLoadingReflection ? 'Generating...' : 'Generate reflection questions'}
                </Button>
              ) : null}

              {articleReflection ? (
                <AiPracticeResultCard
                  badgeLabel="Presentation"
                  content={articleReflection}
                />
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);
