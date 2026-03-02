import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { firebaseDataService, addNutrientMaps, normalizeNutrientMap } from '@/firebase';
import { Dialog, DialogContent, DialogPanel, DialogTitle } from '@/components/ui/dialog';
import {
  type ChatApiMode,
  getOrCreateThreadId,
  sendMessageToAssistant,
  STREAM_END_MARKER
} from './chatservice';
import mealModeResponseSchema from '@/config/meal-mode-response-schema.json';
import { NUTRIENTS_CONFIG } from '@/config/nutrients';
import { cn } from '@/lib/utils';

interface MealDraft {
  food_name: string;
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  source: 'text' | 'image' | 'manual';
}

interface MealModeAiResponse {
  id: string;
  user_id: string;
  daily_log_id: string | null;
  food_name: string;
  nutrient_snapshot: Record<string, number>;
  quantity: number;
  unit: string;
  source: 'text' | 'image' | 'manual';
  logged_at: string;
  created_at: string;
}

type NutrientValueUnit = 'g' | 'mg' | 'mcg' | 'ml' | 'kcal';

const REQUIRED_MEAL_NUTRIENT_KEYS = Object.keys(mealModeResponseSchema.nutrient_snapshot);
const MEAL_MODE_NUTRIENT_UNITS = Object.fromEntries(
  REQUIRED_MEAL_NUTRIENT_KEYS.map(key => [
    key,
    NUTRIENTS_CONFIG.nutrients.find(nutrient => nutrient.key === key)?.unit ?? 'mg'
  ])
) as Record<string, NutrientValueUnit>;
const MEAL_MODE_AMINO_ACID_KEYS = NUTRIENTS_CONFIG.nutrients
  .filter(nutrient => nutrient.category === 'amino_acid')
  .map(nutrient => nutrient.key);
const AMINO_MG_PER_GRAM_PROTEIN: Partial<Record<string, number>> = {
  histidine: 18,
  isoleucine: 36,
  leucine: 69,
  lysine: 58,
  methionine: 27,
  phenylalanine: 45,
  threonine: 35,
  tryptophan: 11,
  valine: 45
};

const convertBetweenMassUnits = (
  value: number,
  fromUnit: Extract<NutrientValueUnit, 'g' | 'mg' | 'mcg'>,
  toUnit: Extract<NutrientValueUnit, 'g' | 'mg' | 'mcg'>
) => {
  if (fromUnit === toUnit) return value;
  const inMg =
    fromUnit === 'g' ? value * 1000 : fromUnit === 'mcg' ? value / 1000 : value;
  if (toUnit === 'g') return inMg / 1000;
  if (toUnit === 'mcg') return inMg * 1000;
  return inMg;
};

const parseNutrientValue = (rawValue: unknown, expectedUnit: NutrientValueUnit): number => {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : 0;
  }

  if (typeof rawValue !== 'string') return 0;
  const normalized = rawValue.trim().toLowerCase().replaceAll(',', '');
  if (!normalized) return 0;

  const matched = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(kcal|g|mg|mcg|ml)?$/i);
  if (!matched) return 0;
  const numeric = Number(matched[1]);
  if (!Number.isFinite(numeric)) return 0;
  const providedUnit = (matched[2]?.toLowerCase() as NutrientValueUnit | undefined) ?? expectedUnit;

  if (providedUnit === expectedUnit) return numeric;
  if (
    (providedUnit === 'g' || providedUnit === 'mg' || providedUnit === 'mcg') &&
    (expectedUnit === 'g' || expectedUnit === 'mg' || expectedUnit === 'mcg')
  ) {
    return convertBetweenMassUnits(numeric, providedUnit, expectedUnit);
  }

  // Do not attempt cross-domain conversions (e.g. kcal -> mg).
  return numeric;
};

const MEAL_MODE_CONTEXT = `You are in MEAL MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema (MealModeAiResponse):
${JSON.stringify(mealModeResponseSchema, null, 2)}
Nutrient units by key (must be followed exactly):
${JSON.stringify(MEAL_MODE_NUTRIENT_UNITS, null, 2)}
Rules:
- JSON must be parseable.
- nutrient_snapshot values must be numbers.
- nutrient_snapshot must include exactly these keys (no extras, no missing): ${REQUIRED_MEAL_NUTRIENT_KEYS.join(
  ', '
)}.
- Do not skip any nutrient key. Every key above must always be present in nutrient_snapshot.
- If exact nutrient data is unknown, provide a best-effort numeric estimate for that key instead of omitting it.
- Never return null, undefined, empty strings, or non-numeric placeholders for nutrient_snapshot values.
- Use exact units from Nutrient units by key. Do not change unit scale.
- Amino acid keys must be in mg (not g): ${MEAL_MODE_AMINO_ACID_KEYS.join(', ')}.
- Example: if leucine is 2.3g, return 2300 (mg) in nutrient_snapshot.leucine.
- source must be one of: text, image, manual.
- Focus only on meal nutrition responses.`;

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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isCurrentRequestStreaming, setIsCurrentRequestStreaming] = useState(false);
  const messagesScrollRootRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const cancelledRequestIdsRef = useRef<Set<string>>(new Set());
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const hasStreamingAssistant = useMemo(
    () =>
      chatHistory.some(messageItem => {
        const messageMetadata = messageItem.metadata as Record<string, unknown> | undefined;
        return messageItem.role === 'assistant' && messageMetadata?.isStreaming === true;
      }),
    [chatHistory]
  );
  const renderedChatMessages = useMemo(
    () => (
      <>
        {chatHistory.map(messageItem => {
          const messageMetadata = messageItem.metadata as
            | Record<string, unknown>
            | undefined;
          const messageImageDataUrl =
            typeof messageMetadata?.imageDataUrl === 'string'
              ? messageMetadata.imageDataUrl
              : null;
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
    ),
    [chatHistory, hasStreamingAssistant, isCurrentRequestStreaming, isLoading]
  );

  const profileContext = useMemo(() => {
    if (!includeMyInfo || !userProfile) return undefined;
    const {
      required_nutrients: _requiredNutrients,
      must_complete_keys: _mustCompleteKeys,
      ...safeProfileContext
    } = userProfile;
    return `MY PROFILE INFO (for personalization):
${JSON.stringify(safeProfileContext, null, 2)}`;
  }, [includeMyInfo, userProfile]);

  const parseMealDraft = (assistantText: string): MealDraft | null => {
    const trimmed = assistantText.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonCandidate = (fencedMatch?.[1] ?? trimmed).trim();
    try {
      const parsedRaw = JSON.parse(jsonCandidate) as Record<string, unknown>;
      if (typeof parsedRaw.food_name !== 'string' || !parsedRaw.food_name.trim()) return null;
      if (typeof parsedRaw.quantity !== 'number' || !Number.isFinite(parsedRaw.quantity)) return null;
      if (typeof parsedRaw.unit !== 'string' || !parsedRaw.unit.trim()) return null;
      const source = parsedRaw.source;
      if (source !== 'text' && source !== 'image' && source !== 'manual') return null;
      const snapshot = parsedRaw.nutrient_snapshot as Record<string, unknown> | undefined;
      if (!snapshot || typeof snapshot !== 'object') return null;
      const snapshotKeys = Object.keys(snapshot);
      const hasAllRequiredKeys = REQUIRED_MEAL_NUTRIENT_KEYS.every(key => snapshotKeys.includes(key));
      const hasOnlyAllowedKeys = snapshotKeys.every(key => REQUIRED_MEAL_NUTRIENT_KEYS.includes(key));
      if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;
      const nutrientSnapshot = Object.fromEntries(
        REQUIRED_MEAL_NUTRIENT_KEYS.map(key => [
          key,
          parseNutrientValue(snapshot[key], MEAL_MODE_NUTRIENT_UNITS[key] ?? 'mg')
        ])
      ) as Record<string, number>;
      const hasAnyAminoValue = MEAL_MODE_AMINO_ACID_KEYS.some(
        key => Number(nutrientSnapshot[key] ?? 0) > 0
      );
      const proteinInGrams = Number(nutrientSnapshot.protein ?? 0);
      if (!hasAnyAminoValue && proteinInGrams > 0) {
        // Fallback estimate using typical essential amino acid profile per gram protein.
        MEAL_MODE_AMINO_ACID_KEYS.forEach(key => {
          const ratio = AMINO_MG_PER_GRAM_PROTEIN[key];
          if (!ratio) return;
          nutrientSnapshot[key] = Math.max(0, Math.round(proteinInGrams * ratio));
        });
      }
      const parsed = {
        id: typeof parsedRaw.id === 'string' ? parsedRaw.id : '',
        user_id: typeof parsedRaw.user_id === 'string' ? parsedRaw.user_id : 'sanket',
        daily_log_id:
          typeof parsedRaw.daily_log_id === 'string' || parsedRaw.daily_log_id === null
            ? parsedRaw.daily_log_id
            : null,
        food_name: parsedRaw.food_name,
        nutrient_snapshot: nutrientSnapshot,
        quantity: parsedRaw.quantity,
        unit: parsedRaw.unit,
        source,
        logged_at: typeof parsedRaw.logged_at === 'string' ? parsedRaw.logged_at : '',
        created_at: typeof parsedRaw.created_at === 'string' ? parsedRaw.created_at : ''
      } as MealModeAiResponse;
      return {
        food_name: parsed.food_name,
        nutrient_snapshot: parsed.nutrient_snapshot,
        quantity: parsed.quantity,
        unit: parsed.unit,
        source: parsed.source
      };
    } catch {
      return null;
    }
  };

  const handleAddMealFromDraft = async () => {
    if (!mealDraft) return;
    setIsAddingMeal(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const mealId = await firebaseDataService.addMealAndUpdateDailyLog({
        name: mealDraft.food_name,
        quantity: mealDraft.quantity,
        unit: mealDraft.unit,
        source: mealDraft.source,
        logDate: today,
        nutrientSnapshot: mealDraft.nutrient_snapshot
      });

      addMeal({
        id: mealId,
        user_id: 'sanket',
        daily_log_id: dailyLog?.id ?? today,
        food_name: mealDraft.food_name,
        nutrient_snapshot: mealDraft.nutrient_snapshot,
        quantity: mealDraft.quantity,
        unit: mealDraft.unit,
        source: mealDraft.source,
        logged_at: now.toISOString(),
        created_at: now.toISOString()
      });

      const updatedConsumed = addNutrientMaps(
        normalizeNutrientMap(dailyLog?.consumed_nutrients ?? {}),
        normalizeNutrientMap(mealDraft.nutrient_snapshot)
      );
      if (dailyLog) {
        setDailyLog({
          ...dailyLog,
          consumed_nutrients: updatedConsumed,
          updated_at: now.toISOString()
        });
      }

      setMealDraft(null);
    } catch (error) {
      setError('chat', error instanceof Error ? error.message : 'Failed to add meal.');
    } finally {
      setIsAddingMeal(false);
    }
  };

  const handleSend = async () => {
    const content = message.trim();
    if (!content && !attachedImage) return;
    if (content.length > 4000) {
      setError('chat', 'Message is too long. Keep it under 4000 characters.');
      return;
    }

    const existingThreadId = [...chatHistory]
      .reverse()
      .map(item =>
        apiMode === 'conversation'
          ? item.metadata?.conversationId
          : item.metadata?.previousResponseId
      )
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

    setLoading('chat', true);
    setError('chat', null);

    try {
      const requestId = crypto.randomUUID();
      activeRequestIdRef.current = requestId;
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const contextId = await getOrCreateThreadId(existingThreadId, apiMode);
      const shouldStreamAssistant = composerMode !== 'meal';
      setIsCurrentRequestStreaming(shouldStreamAssistant);
      const streamingAssistantMessageId = shouldStreamAssistant ? crypto.randomUUID() : null;
      addChatMessage({
        id: crypto.randomUUID(),
        user_id: 'local-user',
        role: 'user',
        content: content || '📷 Image attached',
        metadata:
          apiMode === 'conversation'
            ? {
              apiMode,
              conversationId: contextId,
              hasImage: Boolean(attachedImage),
              imageName: attachedImage?.name
            }
            : {
              apiMode,
              previousResponseId: contextId,
              hasImage: Boolean(attachedImage),
              imageName: attachedImage?.name
            },
        created_at: new Date().toISOString()
      });
      setMessage('');
      setAttachedImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }

      if (streamingAssistantMessageId) {
        addChatMessage({
          id: streamingAssistantMessageId,
          user_id: 'assistant',
          role: 'assistant',
          content: '',
          metadata:
            apiMode === 'conversation'
              ? { apiMode, conversationId: contextId, isStreaming: true }
              : { apiMode, previousResponseId: contextId, isStreaming: true },
          created_at: new Date().toISOString()
        });
      }

      const { assistantText, conversationId: nextContextId } =
        await sendMessageToAssistant({
          conversationId: contextId,
          content,
          imageDataUrl: attachedImage?.dataUrl,
          mealContext: [composerMode === 'meal' ? MEAL_MODE_CONTEXT : undefined, profileContext]
            .filter((value): value is string => Boolean(value?.trim()))
            .join('\n\n'),
          mode: apiMode,
          stream: shouldStreamAssistant,
          endMarker: STREAM_END_MARKER,
          abortSignal: abortController.signal,
          onStreamChunk: streamingAssistantMessageId
            ? streamedText => {
              if (cancelledRequestIdsRef.current.has(requestId)) return;
              const currentHistory = useAppStore.getState().chatHistory;
              const nextHistory = currentHistory.map(item =>
                item.id === streamingAssistantMessageId
                  ? {
                    ...item,
                    content: streamedText,
                    metadata: {
                      ...(item.metadata as Record<string, unknown>),
                      isStreaming: true
                    }
                  }
                  : item
              );
              setChatHistory(nextHistory);
            }
            : undefined
        });

      if (cancelledRequestIdsRef.current.has(requestId)) {
        return;
      }

      if (streamingAssistantMessageId) {
        const currentHistory = useAppStore.getState().chatHistory;
        const nextHistory = currentHistory.map(item =>
          item.id === streamingAssistantMessageId
            ? {
              ...item,
              content: assistantText,
              metadata:
                apiMode === 'conversation'
                  ? { apiMode, conversationId: nextContextId }
                  : {
                    apiMode,
                    previousResponseId: nextContextId
                  }
            }
            : item
        );
        setChatHistory(nextHistory);
      } else {
        addChatMessage({
          id: crypto.randomUUID(),
          user_id: 'assistant',
          role: 'assistant',
          content: assistantText,
          metadata:
            apiMode === 'conversation'
              ? { apiMode, conversationId: nextContextId }
              : {
                apiMode,
                previousResponseId: nextContextId
              },
          created_at: new Date().toISOString()
        });
      }

      if (composerMode === 'meal') {
        const parsedMeal = parseMealDraft(assistantText);
        if (parsedMeal) {
          setMealDraft(parsedMeal);
        }
      }
    } catch (error) {
      if (activeRequestIdRef.current && cancelledRequestIdsRef.current.has(activeRequestIdRef.current)) {
        return;
      }
      const currentHistory = useAppStore.getState().chatHistory;
      const cleanedHistory = currentHistory.filter(item => {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        const isStreaming = metadata?.isStreaming === true;
        return !(isStreaming && !item.content.trim());
      });
      if (cleanedHistory.length !== currentHistory.length) {
        setChatHistory(cleanedHistory);
      }
      setError('chat', error instanceof Error ? error.message : 'Unable to send message.');
    } finally {
      const activeRequestId = activeRequestIdRef.current;
      if (activeRequestId) {
        cancelledRequestIdsRef.current.delete(activeRequestId);
      }
      activeRequestIdRef.current = null;
      activeAbortControllerRef.current = null;
      setIsCurrentRequestStreaming(false);
      setLoading('chat', false);
    }
  };

  const handleStopGeneration = () => {
    const activeRequestId = activeRequestIdRef.current;
    if (!activeRequestId) return;
    cancelledRequestIdsRef.current.add(activeRequestId);
    activeAbortControllerRef.current?.abort();

    const currentHistory = useAppStore.getState().chatHistory;
    const cleanedHistory = currentHistory
      .filter(item => {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        const isStreaming = metadata?.isStreaming === true;
        return !(isStreaming && !item.content.trim());
      })
      .map(item => {
        const metadata = item.metadata as Record<string, unknown> | undefined;
        if (metadata?.isStreaming !== true) return item;
        const { isStreaming: _isStreaming, ...restMetadata } = metadata;
        return {
          ...item,
          metadata: restMetadata
        };
      });

    if (cleanedHistory.length !== currentHistory.length) {
      setChatHistory(cleanedHistory);
    }

    setIsCurrentRequestStreaming(false);
    setLoading('chat', false);
    setError('chat', null);
  };

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

  const scrollToEnd = () => {
    const viewport = messagesScrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;

    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const viewport = messagesScrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;

    if (!viewport) return;

    const updateBottomState = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setIsAtBottom(distanceFromBottom <= 8);
    };

    updateBottomState();
    viewport.addEventListener('scroll', updateBottomState);

    return () => {
      viewport.removeEventListener('scroll', updateBottomState);
    };
  }, [chatHistory.length]);




  useEffect(() => {
    // Keep latest message visible on initial open and on every new message.
    const timer = window.setTimeout(() => {
      scrollToEnd();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [chatHistory.length]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setTimeout(() => {
      const viewport = messagesScrollRootRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLDivElement | null;
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isLoading, chatHistory.length]);

  return (
    <main className="min-h-screen  text-foreground">
      <section className="mx-auto w-full max-w-lg px-4 py-4">
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
                    {renderedChatMessages}
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
                        void handleSend();
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
                          void handleSend();
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
            <Dialog
              onOpenChange={open => {
                if (!open) setMealDraft(null);
              }}
              open={Boolean(mealDraft)}
            >
              <DialogContent className="sm:max-w-md border-none shadow-none">
                <DialogPanel className="space-y-3">
                  <DialogTitle>Meal Preview</DialogTitle>
                  {mealDraft ? (
                    <div className="space-y-2 text-sm">
                      <div className="rounded-md border border-border/60 px-3 py-2">
                        <p className="font-medium">{mealDraft.food_name}</p>
                        <p className="text-muted-foreground">
                          {mealDraft.quantity} {mealDraft.unit} • {mealDraft.source}
                        </p>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
                        {Object.entries(mealDraft.nutrient_snapshot)
                          .filter(([, value]) => Number(value) > 0)
                          .map(([key, value]) => (
                            <div className="flex items-center justify-between" key={key}>
                              <span className="text-muted-foreground">{key}</span>
                              <span>{Number(value).toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => setMealDraft(null)}
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                        <Button
                          disabled={isAddingMeal}
                          onClick={() => {
                            void handleAddMealFromDraft();
                          }}
                          type="button"
                        >
                          {isAddingMeal ? 'Adding...' : 'Add to Today Meals'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </DialogPanel>
              </DialogContent>
            </Dialog>
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
