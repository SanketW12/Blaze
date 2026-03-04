import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Sparkles,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea
} from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store';
import {
  type ChatApiMode
} from './chatservice';
import { parseMealDraft } from './utils/mealDraftParser';
import { addMealFromDraft } from './services/mealDraftService';
import { useChatScroll } from './hooks/useChatScroll';
import type { ChatMessageItem, MealDraft } from './types/chat';
import { ChatMessageList } from './components/ChatMessageList';
import { MealDraftDialog } from './components/MealDraftDialog';
import { useChatRequestController } from './hooks/useChatRequestController';
import { useProfileContext } from './hooks/useProfileContext';

const ChatPage = () => {
  const chatHistory = useAppStore(state => state.chatHistory);
  const addChatMessage = useAppStore(state => state.addChatMessage);
  const setChatHistory = useAppStore(state => state.setChatHistory);
  const addMeal = useAppStore(state => state.addMeal);
  const userProfile = useAppStore(state => state.userProfile);
  const dailyLog = useAppStore(state => state.dailyLog);
  const setDailyLog = useAppStore(state => state.setDailyLog);
  const setLoading = useAppStore(state => state.setLoading);
  const setError = useAppStore(state => state.setError);
  const isLoading = useAppStore(state => state.loading.chat);
  const chatError = useAppStore(state => state.errors.chat);
  const [message, setMessage] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const [composerMode, setComposerMode] = useState<'default' | 'meal'>('default');
  const [includeMyInfo, setIncludeMyInfo] = useState(false);
  const [apiMode, setApiMode] = useState<ChatApiMode>('conversation');
  const [mealDraft, setMealDraft] = useState<MealDraft | null>(null);
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const {
    isAtBottom,
    messagesScrollRootRef,
    scrollToEnd
  } = useChatScroll({ isLoading, messageCount: chatHistory.length });
  const hasStreamingAssistant = useMemo(
    () =>
      chatHistory.some(messageItem => {
        const messageMetadata = messageItem.metadata as Record<string, unknown> | undefined;
        return messageItem.role === 'assistant' && messageMetadata?.isStreaming === true;
      }),
    [chatHistory]
  );

  const profileContext = useProfileContext({ includeMyInfo, userProfile });

  const handleAddMealFromDraft = async () => {
    if (!mealDraft) return;
    setIsAddingMeal(true);
    try {
      await addMealFromDraft({
        mealDraft,
        dailyLog,
        addMeal,
        setDailyLog
      });

      setMealDraft(null);
    } catch (error) {
      setError('chat', error instanceof Error ? error.message : 'Failed to add meal.');
    } finally {
      setIsAddingMeal(false);
    }
  };

  const { isCurrentRequestStreaming, handleSend, handleStopGeneration } = useChatRequestController({
    chatHistory,
    apiMode,
    composerMode,
    profileContext,
    setLoading,
    setError,
    addChatMessage,
    setChatHistory,
    getCurrentChatHistory: () => useAppStore.getState().chatHistory,
    parseMealDraft,
    setMealDraft,
    clearComposer: () => {
      setMessage('');
      setAttachedImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  });

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('chat', 'Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage({
          dataUrl: reader.result,
          name: file.name
        });
        setError('chat', null);
      }
    };
    reader.onerror = () => {
      setError('chat', 'Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="min-h-screen  text-foreground">
      <section className="mx-auto w-full max-w-lg ">
        <div className="mb-4 flex items-center justify-between">

          <h1 className="text-xl font-semibold">Chat with Blaze</h1>
          <Button
            onClick={() =>
              setApiMode(prev =>
                prev === 'responses' ? 'conversation' : 'responses'
              )
            }
            size="xs"
            type="button"
            variant="outline"
          >
            Switch API
          </Button>
        </div>

        <Card className="border-none  shadow-none">
          <CardContent className="space-y-4 p-0 pb-36">
            {chatHistory.length === 0 ? (
              <div className="flex min-h-[56vh] flex-col items-center justify-center gap-4 px-4 text-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Sparkles className="size-9" />
                </div>
                <div className="space-y-1">
                  <p className="text-4xl font-bold">Hello Sanket!</p>
                  <p className="text-muted-foreground">
                    Ask anything about your meals or nutrition.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <ScrollArea
                  className="h-[65vh] rounded-xl border border-border/60 bg-muted/20 p-3"
                  ref={messagesScrollRootRef}
                >
                  <div className="space-y-3">
                    <ChatMessageList
                      chatHistory={chatHistory as ChatMessageItem[]}
                      hasStreamingAssistant={hasStreamingAssistant}
                      isCurrentRequestStreaming={isCurrentRequestStreaming}
                      isLoading={isLoading}
                    />
                  </div>
                </ScrollArea>
                {!isAtBottom ? (
                  <Button
                    aria-label="Scroll to end"
                    className="absolute bottom-3 right-3 rounded-full"
                    onClick={scrollToEnd}
                    size="icon-lg"
                    type="button"
                    variant="secondary"
                  >
                    <ArrowDown />
                  </Button>
                ) : null}
              </div>
            )}

            {/* <div className="flex gap-2 overflow-x-auto px-1 pb-1">
              {quickPrompts.map(prompt => (
                <Badge
                  className="cursor-pointer rounded-2xl px-3 py-2 text-sm whitespace-nowrap"
                  key={prompt}
                  onClick={() => setMessage(prompt)}
                  variant="outline"
                >
                  {prompt}
                </Badge>
              ))}
            </div> */}



            <div className="fixed right-0 bottom-[68px] left-0 z-40">
              <div className="mx-auto w-full max-w-lg px-4">
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                  ref={imageInputRef}
                  type="file"
                />
                <InputGroup>
                  <InputGroupTextarea
                    size="sm"
                    onChange={event => setMessage(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend({ message, attachedImage });
                      }
                    }}
                    placeholder="Ask, Search or Chat..."
                    value={message}
                  />
                  {attachedImage ? (
                    <div className="absolute right-2 top-2 ml-2">
                      <img
                        alt={attachedImage.name}
                        className="size-12 rounded-md border border-border/60 object-cover"
                        src={attachedImage.dataUrl}
                      />
                      <Button
                        aria-label="Remove attached image"
                        className="-top-1.5 -right-1.5 absolute size-5 rounded-full"
                        onClick={() => {
                          setAttachedImage(null);
                          if (imageInputRef.current) {
                            imageInputRef.current.value = '';
                          }
                        }}
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : null}
                  <InputGroupAddon
                    align="block-end"
                    className="flex w-full items-end gap-2 justify-start"
                  >
                    <Button
                      aria-label="Attach image"
                      onClick={() => imageInputRef.current?.click()}
                      className="shrink-0"
                      size="icon-xs"
                      type="button"
                      variant="outline"
                    >
                      <Plus />
                    </Button>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Badge
                        onClick={() =>
                          setComposerMode(prev => (prev === 'meal' ? 'default' : 'meal'))
                        }
                        className={
                          composerMode === 'meal'
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : ''
                        }
                        variant={composerMode === 'meal' ? 'secondary' : 'outline'}
                      >
                        {composerMode === 'meal' ? 'Meal mode: ON' : 'Meal mode: Off'}
                      </Badge>
                      <Badge
                        onClick={() => setIncludeMyInfo(prev => !prev)}
                        className={
                          includeMyInfo ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300' : ''
                        }
                        variant={includeMyInfo ? 'secondary' : 'outline'}
                      >
                        {includeMyInfo ? 'Profile: On' : 'Profile: Off'}
                      </Badge>
                      <Badge
                        className="border-green-500/40 bg-green-500/15 text-green-300"
                        variant="outline"
                      >
                        {apiMode === 'responses'
                          ? 'Active: Responses'
                          : 'Active: Conversation'}
                      </Badge>
                    </div>
                    <Separator className="hidden h-4 sm:block" orientation="vertical" />
                    {isLoading ? (
                      <Button
                        aria-label="Stop generation"
                        className="ml-auto shrink-0"
                        onClick={handleStopGeneration}
                        size="icon-xs"
                        type="button"
                        variant="destructive"
                      >
                        <X />
                      </Button>
                    ) : (
                      <Button
                        aria-label="Send"
                        className="ml-auto shrink-0"
                        disabled={!message.trim() && !attachedImage}
                        onClick={() => {
                          void handleSend({ message, attachedImage });
                        }}
                        size="icon-xs"
                        type="button"
                      >
                        <ArrowUp />
                      </Button>
                    )}
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>
            <MealDraftDialog
              isAddingMeal={isAddingMeal}
              mealDraft={mealDraft}
              onAdd={() => {
                void handleAddMealFromDraft();
              }}
              onCancel={() => setMealDraft(null)}
              onOpenChange={open => {
                if (!open) setMealDraft(null);
              }}
            />
            {chatError ? (
              <p className="px-1 text-sm text-destructive-foreground">{chatError}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default ChatPage;
