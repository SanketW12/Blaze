import { useRef, useState } from 'react';
import {
  type ChatApiMode,
  STREAM_END_MARKER,
  getOrCreateThreadId,
  sendMessageToAssistant
} from '../chatservice';
import { MEAL_MODE_CONTEXT } from '../constants/mealMode';
import type { MealDraft } from '../types/chat';
import type { AppStoreState } from '@/store/useAppStore';

type AttachedImage = {
  dataUrl: string;
  name: string;
} | null;

type ChatHistoryItem = AppStoreState['chatHistory'][number];

interface UseChatRequestControllerParams {
  chatHistory: AppStoreState['chatHistory'];
  apiMode: ChatApiMode;
  composerMode: 'default' | 'meal';
  profileContext?: string;
  setLoading: AppStoreState['setLoading'];
  setError: AppStoreState['setError'];
  addChatMessage: AppStoreState['addChatMessage'];
  setChatHistory: AppStoreState['setChatHistory'];
  getCurrentChatHistory: () => AppStoreState['chatHistory'];
  parseMealDraft: (assistantText: string) => MealDraft | null;
  setMealDraft: (draft: MealDraft | null) => void;
  clearComposer: () => void;
}

const stripStreamingMetadata = (messages: ChatHistoryItem[]) =>
  messages
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

export const useChatRequestController = ({
  chatHistory,
  apiMode,
  composerMode,
  profileContext,
  setLoading,
  setError,
  addChatMessage,
  setChatHistory,
  getCurrentChatHistory,
  parseMealDraft,
  setMealDraft,
  clearComposer
}: UseChatRequestControllerParams) => {
  const [isCurrentRequestStreaming, setIsCurrentRequestStreaming] = useState(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const cancelledRequestIdsRef = useRef<Set<string>>(new Set());
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const handleSend = async ({
    message,
    attachedImage
  }: {
    message: string;
    attachedImage: AttachedImage;
  }) => {
    const content = message.trim();
    if (!content && !attachedImage) return;
    if (content.length > 4000) {
      setError('chat', 'Message is too long. Keep it under 4000 characters.');
      return;
    }

    const existingThreadId = [...chatHistory]
      .reverse()
      .map(item =>
        apiMode === 'conversation' ? item.metadata?.conversationId : item.metadata?.previousResponseId
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
      clearComposer();

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

      const { assistantText, conversationId: nextContextId } = await sendMessageToAssistant({
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
            const currentHistory = getCurrentChatHistory();
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
        const currentHistory = getCurrentChatHistory();
        const nextHistory = currentHistory.map(item =>
          item.id === streamingAssistantMessageId
            ? {
              ...item,
              content: assistantText,
              metadata:
                apiMode === 'conversation'
                  ? { apiMode, conversationId: nextContextId }
                  : { apiMode, previousResponseId: nextContextId }
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
              : { apiMode, previousResponseId: nextContextId },
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
      const currentHistory = getCurrentChatHistory();
      const cleanedHistory = stripStreamingMetadata(currentHistory);
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

    const currentHistory = getCurrentChatHistory();
    const cleanedHistory = stripStreamingMetadata(currentHistory);
    if (cleanedHistory.length !== currentHistory.length) {
      setChatHistory(cleanedHistory);
    }

    setIsCurrentRequestStreaming(false);
    setLoading('chat', false);
    setError('chat', null);
  };

  return {
    isCurrentRequestStreaming,
    handleSend,
    handleStopGeneration
  };
};
