const MAX_MESSAGE_LENGTH = 4000;
export type ChatApiMode = "responses" | "conversation";
const CHAT_FUNCTION_PATH = "/.netlify/functions/chat";
export const STREAM_END_MARKER = "__BLAZE_STREAM_END__";

const trimEnv = (value: string | undefined) => {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  return normalized || undefined;
};

const getLocalModel = () => trimEnv(import.meta.env.VITE_OPENAI_MODEL) || "gpt-4.1-mini";

const getLocalMaxOutputTokens = () => {
  const value = Number(trimEnv(import.meta.env.VITE_OPENAI_MAX_OUTPUT_TOKENS));
  return Number.isFinite(value) && value > 0 ? value : 1000;
};

const getDefaultConversationId = () => trimEnv(import.meta.env.VITE_THREAD_ID);

const normalizeChatError = (error: unknown) => {
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message.toLowerCase().includes("abort") ||
      error.message.toLowerCase().includes("cancel"))
  ) {
    return "Request cancelled.";
  }
  if (error instanceof Error) return error.message;
  return "Unable to send message right now. Please try again.";
};

export const getOrCreateThreadId = async (
  existingThreadId?: string,
  mode: ChatApiMode = "responses",
) => {
  const candidateId = existingThreadId?.trim();
  if (mode === "responses") {
    if (candidateId?.startsWith("resp_")) return candidateId;
    return undefined;
  }

  if (candidateId?.startsWith("conv_")) return candidateId;

  const defaultConversationId = getDefaultConversationId();
  if (defaultConversationId?.startsWith("conv_")) return defaultConversationId;

  return undefined;
};

const parseJsonSafely = async (response: Response) => {
  const rawBody = await response.text();
  try {
    return {
      rawBody,
      data: JSON.parse(rawBody) as Record<string, unknown>,
    };
  } catch {
    return {
      rawBody,
      data: {} as Record<string, unknown>,
    };
  }
};

const createBufferedChunkEmitter = (onStreamChunk?: (textSoFar: string) => void) => {
  if (!onStreamChunk) {
    return {
      emit: (_text: string) => {},
      flush: (_text: string) => {},
    };
  }

  let latestText = "";
  let rafId: number | null = null;

  const flush = (text: string) => {
    latestText = text;
    if (rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    onStreamChunk(latestText);
  };

  const emit = (text: string) => {
    latestText = text;
    if (rafId !== null) return;
    if (typeof window === "undefined") {
      onStreamChunk(latestText);
      return;
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      onStreamChunk(latestText);
    });
  };

  return { emit, flush };
};

const sendMessageViaBrowserOpenAI = async ({
  conversationId,
  content,
  imageDataUrl,
  mealContext,
  mode,
  onStreamChunk,
  abortSignal,
}: {
  conversationId?: string;
  content: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode: ChatApiMode;
  onStreamChunk?: (textSoFar: string) => void;
  abortSignal?: AbortSignal;
}) => {
  const apiKey = import.meta.env.VITE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Local dev fallback requires VITE_API_KEY.");
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const contextId = await getOrCreateThreadId(conversationId, mode);
  const payload: {
    model: string;
    max_output_tokens: number;
    input: Array<{
      role: "user";
      content: Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string; detail: "auto" }
      >;
    }>;
    instructions?: string;
    previous_response_id?: string;
    conversation?: string;
  } = {
    model: getLocalModel(),
    max_output_tokens: getLocalMaxOutputTokens(),
    input: [
      {
        role: "user",
        content: [
          ...(content.trim()
            ? [{ type: "input_text" as const, text: content.trim() }]
            : []),
          ...(imageDataUrl?.trim()
            ? [
                {
                  type: "input_image" as const,
                  image_url: imageDataUrl.trim(),
                  detail: "auto" as const,
                },
              ]
            : []),
        ],
      },
    ],
  };

  if (mealContext?.trim()) {
    payload.instructions = mealContext.trim();
  }

  if (mode === "conversation" && contextId) {
    payload.conversation = contextId;
  } else if (mode === "responses" && contextId) {
    payload.previous_response_id = contextId;
  }

  // Real token streaming from OpenAI SDK in browser.
  const stream = await (
    client.responses.stream as unknown as (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<{
      [Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>>;
      finalResponse?: () => Promise<{ id?: string; output_text?: string }>;
    }>
  )(payload, { signal: abortSignal });

  let assistantText = "";
  let responseId: string | undefined;
  const streamEmitter = createBufferedChunkEmitter(onStreamChunk);
  let streamCompleted = false;

  for await (const eventChunk of stream) {
    const eventType = eventChunk.type;
    if (eventType === "response.created") {
      const responseObject = eventChunk.response as { id?: string } | undefined;
      if (typeof responseObject?.id === "string") {
        responseId = responseObject.id;
      }
    }
    if (eventType === "response.output_text.delta") {
      const delta = eventChunk.delta;
      if (typeof delta === "string") {
        assistantText += delta;
        streamEmitter.emit(assistantText);
      }
    }

    if (eventType === "response.completed") {
      streamCompleted = true;
      const responseObject = eventChunk.response as
        | { id?: string; output_text?: string }
        | undefined;
      if (!assistantText && typeof responseObject?.output_text === "string") {
        assistantText = responseObject.output_text;
        streamEmitter.emit(assistantText);
      }
      if (typeof responseObject?.id === "string") {
        responseId = responseObject.id;
      }
    }
  }

  if (typeof stream.finalResponse === "function") {
    const finalResponse = await stream.finalResponse();
    if (!assistantText && typeof finalResponse.output_text === "string") {
      assistantText = finalResponse.output_text;
      streamEmitter.emit(assistantText);
    }
    if (typeof finalResponse.id === "string") {
      responseId = finalResponse.id;
    }
  }

  if (!assistantText.trim()) {
    if (abortSignal?.aborted) {
      if (responseId) {
        try {
          await client.responses.cancel(responseId);
        } catch {
          // Best-effort cancellation; ignore failure.
        }
      }
      throw new DOMException("Request aborted", "AbortError");
    }
    throw new Error("Response API returned an empty message.");
  }

  if (abortSignal?.aborted && !streamCompleted) {
    if (responseId) {
      try {
        await client.responses.cancel(responseId);
      } catch {
        // Best-effort cancellation; ignore failure.
      }
    }
    throw new DOMException("Request aborted", "AbortError");
  }

  streamEmitter.flush(assistantText);

  return {
    conversationId: mode === "conversation" ? contextId ?? responseId : responseId,
    assistantText: assistantText.trim(),
  };
};

export const sendMessageToAssistant = async ({
  conversationId,
  content,
  imageDataUrl,
  mealContext,
  mode = "responses",
  stream = false,
  endMarker = STREAM_END_MARKER,
  onStreamChunk,
  abortSignal,
}: {
  conversationId?: string;
  content: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode?: ChatApiMode;
  stream?: boolean;
  endMarker?: string;
  onStreamChunk?: (textSoFar: string) => void;
  abortSignal?: AbortSignal;
}) => {
  const trimmedMessage = content.trim();
  const trimmedImageDataUrl = imageDataUrl?.trim();
  if (!trimmedMessage && !trimmedImageDataUrl) {
    throw new Error("Message or image is required.");
  }
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Message is too long. Keep it under ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }
  if (trimmedImageDataUrl && !trimmedImageDataUrl.startsWith("data:image/")) {
    throw new Error("Attached image format is invalid.");
  }

  // For non-meal mode stream UX, use direct OpenAI SDK stream (real incremental chunks).
  if (stream) {
    try {
      return await sendMessageViaBrowserOpenAI({
        conversationId,
        content: trimmedMessage,
        imageDataUrl: trimmedImageDataUrl,
        mealContext,
        mode,
        onStreamChunk,
        abortSignal,
      });
    } catch (error) {
      throw new Error(normalizeChatError(error));
    }
  }

  try {
    const baseUrl = import.meta.env.VITE_CHAT_FUNCTION_URL?.trim() || CHAT_FUNCTION_PATH;
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: abortSignal,
      body: JSON.stringify({
        conversationId,
        content: trimmedMessage,
        imageDataUrl: trimmedImageDataUrl,
        mealContext: mealContext?.trim() || undefined,
        mode,
        stream,
        endMarker,
      }),
    });

    const { data, rawBody } = await parseJsonSafely(response);
    if (!response.ok) {
      const maybeError = typeof data.error === "string" ? data.error : "";
      const bodyLower = rawBody.toLowerCase();
      if (
        response.status === 504 ||
        bodyLower.includes("gateway timeout") ||
        bodyLower.includes("inactivity timeout")
      ) {
        throw new Error(
          "The AI response took too long and timed out. Please retry.",
        );
      }
      throw new Error(maybeError || "Chat request failed.");
    }

    const assistantText =
      typeof data.assistantText === "string" ? data.assistantText.trim() : "";
    if (!assistantText) {
      throw new Error("Response API returned an empty message.");
    }

    const normalizedText = (() => {
      if (!stream) return assistantText;
      const marker = endMarker.trim();
      if (!marker) return assistantText;
      const markerIndex = assistantText.lastIndexOf(marker);
      if (markerIndex === -1) {
        throw new Error("Stream ended without completion marker. Please retry.");
      }
      return assistantText.slice(0, markerIndex).trim();
    })();

    return {
      conversationId:
        typeof data.conversationId === "string" ? data.conversationId : undefined,
      assistantText: normalizedText,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      try {
        const fallbackResult = await sendMessageViaBrowserOpenAI({
          conversationId,
          content: trimmedMessage,
          imageDataUrl: trimmedImageDataUrl,
          mealContext,
          mode,
          onStreamChunk,
        });
        const fallbackText = fallbackResult.assistantText.trim();
        if (!stream) return fallbackResult;
        return {
          ...fallbackResult,
          assistantText: fallbackText,
        };
      } catch (fallbackError) {
        throw new Error(normalizeChatError(fallbackError));
      }
    }
    throw new Error(normalizeChatError(error));
  }
};
