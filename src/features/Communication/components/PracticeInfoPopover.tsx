import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover';
import type { CommunicationSectionItem } from '../types/communication';

interface PracticeInfoPopoverProps {
  section: CommunicationSectionItem;
}

export const PracticeInfoPopover = ({
  section
}: PracticeInfoPopoverProps) => (
  <Popover>
    <PopoverTrigger
      onClick={event => {
        event.stopPropagation();
      }}
      onPointerDown={event => {
        event.stopPropagation();
      }}
      render={
        <Button
          aria-label={`About ${section.label}`}
          size="icon-xs"
          type="button"
          variant="ghost"
        />
      }
    >
      <Info className="size-3" />
    </PopoverTrigger>
    <PopoverContent
      align="start"
      className="w-80 space-y-3 border-border-muted/10"
      onClick={event => {
        event.stopPropagation();
      }}
      side="bottom"
    >
      <div className="space-y-1">
        <PopoverTitle>{section.label}</PopoverTitle>
        <PopoverDescription>{section.description}</PopoverDescription>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">How to do it</p>
        <ul className="space-y-2">
          {section.tasks
            .filter(task => task.type === 'checkbox')
            .map(task => (
              <li className="text-sm" key={task.id}>
                {task.label}
              </li>
            ))}
        </ul>
      </div>
    </PopoverContent>
  </Popover>
);
