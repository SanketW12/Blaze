import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ChatMessageItem } from '../types/chat';

const MARKDOWN_COMPONENTS = {
  a: (props: React.ComponentProps<'a'>) => (
    <a
      {...props}
      className="underline"
      rel="noreferrer"
      target="_blank"
    />
  ),
  code: (props: React.ComponentProps<'code'>) => (
    <code
      {...props}
      className="rounded bg-black/20 px-1 py-0.5 font-mono text-xs"
    />
  ),
  p: (props: React.ComponentProps<'p'>) => <p {...props} className="text-sm whitespace-pre-wrap" />
};

interface ChatMessageListProps {
  chatHistory: ChatMessageItem[];
  hasStreamingAssistant: boolean;
  isCurrentRequestStreaming: boolean;
  isLoading: boolean;
}

export const ChatMessageList = ({
  chatHistory,
  hasStreamingAssistant,
  isCurrentRequestStreaming,
  isLoading
}: ChatMessageListProps) => (
  <>
    {chatHistory.map(messageItem => {
      const messageMetadata = messageItem.metadata as Record<string, unknown> | undefined;
      const messageImageDataUrl =
        typeof messageMetadata?.imageDataUrl === 'string' ? messageMetadata.imageDataUrl : null;
      const isStreamingMessage = messageMetadata?.isStreaming === true;

      return (
        <div
          className={cn('w-[85%] rounded-xl px-3 py-2 invisible', {
            'ml-auto bg-primary text-primary-foreground': messageItem.role === 'user',
            'mr-auto bg-muted': messageItem.role !== 'user',
            visible: Boolean(messageItem?.content) || isStreamingMessage
          })}
          key={messageItem.id}
        >
          {messageImageDataUrl ? (
            <img
              alt="Attached message"
              className="mb-2 max-h-56 w-full rounded-md object-cover"
              src={messageImageDataUrl}
            />
          ) : null}

          <ReactMarkdown
            components={MARKDOWN_COMPONENTS}
            remarkPlugins={[remarkGfm]}
          >
            {messageItem.content}
          </ReactMarkdown>
          {isStreamingMessage && !messageItem.content.trim() ? (
            <p className="text-sm text-muted-foreground">
              Blaze is generating an answer...
            </p>
          ) : null}
          {isStreamingMessage && messageItem.content.trim() ? (
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current align-middle opacity-80"
            />
          ) : null}
        </div>
      );
    })}
    {isLoading && (!isCurrentRequestStreaming || !hasStreamingAssistant) ? (
      <div className="mr-auto w-[85%] rounded-xl bg-muted px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Blaze is generating an answer...</span>
        </div>
      </div>
    ) : null}
  </>
);
