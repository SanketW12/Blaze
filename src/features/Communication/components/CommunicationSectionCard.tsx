import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CommunicationAiContent, CommunicationSectionItem } from '../types/communication';
import { AiPracticeResultCard } from './AiPracticeResultCard';
import { CommunicationChecklist } from './CommunicationChecklist';
import { PracticeInfoPopover } from './PracticeInfoPopover';

interface CommunicationSectionCardProps {
  section: CommunicationSectionItem;
  aiContent?: CommunicationAiContent;
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
  children?: React.ReactNode;
}

export const CommunicationSectionCard = ({
  section,
  aiContent,
  isSaving = false,
  actionHandlers,
  onToggleTask,
  children
}: CommunicationSectionCardProps) => (
  <Card className="bg-muted/25 shadow-none">
    <CardContent className="p-4">
      <Accordion defaultValue={[section.key]} multiple>
        <AccordionItem className="border-none" value={section.key}>
          <AccordionTrigger className="py-0">
            <div className="w-full space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center ">
                    <p className="text-sm font-semibold">{section.label}</p>
                    <PracticeInfoPopover section={section} />
                    {/* <Badge variant="outline">{section.weight}% weight</Badge> */}

                  </div>
                  <div>

                    <div className="flex items-center gap-2">


                      <p className="text-muted-foreground text-xs min-w-[90%]">{section.description}</p>

                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">

                  <p className="text-muted-foreground text-xs font-semibold whitespace-nowrap ">
                    {section.progress.toFixed(0)} / 100%
                  </p>

                </div>
              </div>
              <Progress className="h-2.5" value={section.progress} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-4">
              <CommunicationChecklist
                actionHandlers={actionHandlers}
                isSaving={isSaving}
                onToggleTask={onToggleTask}
                tasks={section.tasks}
              />
              {children}
              {aiContent ? <AiPracticeResultCard content={aiContent} /> : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </CardContent>
  </Card>
);
