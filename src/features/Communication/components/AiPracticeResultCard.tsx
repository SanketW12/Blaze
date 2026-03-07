import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { CommunicationAiContent } from '../types/communication';

interface AiPracticeResultCardProps {
  content: CommunicationAiContent;
  badgeLabel?: string;
}

export const AiPracticeResultCard = ({
  content,
  badgeLabel = 'AI Practice'
}: AiPracticeResultCardProps) => (
  <Card className="bg-muted/35 shadow-none">
    <CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{content.title}</p>
          {content.summary ? (
            <p className="text-muted-foreground mt-1 text-xs">{content.summary}</p>
          ) : null}
        </div>
        <Badge variant="outline">{badgeLabel}</Badge>
      </div>
      <ul className="space-y-2">
        {content.items.map(item => (
          <li className="text-sm" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
