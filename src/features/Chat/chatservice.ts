const MAX_MESSAGE_LENGTH = 4000;
export type ChatApiMode = "responses" | "conversation";
const CHAT_FUNCTION_PATH = "/.netlify/functions/chat";
const CHAT_BACKGROUND_FUNCTION_PATH = "/.netlify/functions/chat-background";
const CHAT_STATUS_FUNCTION_PATH = "/.netlify/functions/chat-status";
const DEFAULT_MODEL = "gpt-4o-mini";
const BACKGROUND_POLL_INTERVAL_MS = 1200;
const BACKGROUND_MAX_POLL_MS = 150000;

const normalizeChatError = (error: unknown) => {
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
  return undefined;
};

const extractAssistantText = (response: {
  output_text?: string;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}) => {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const textParts =
    response.output
      ?.filter((item) => item.type === "message" && item.role === "assistant")
      .flatMap((item) => item.content ?? [])
      .filter(
        (part) => part.type === "output_text" && typeof part.text === "string",
      )
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return textParts.join("\n").trim();
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const createJobId = () => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

const getFunctionBaseUrls = () => {
  const configuredChatFunctionUrl = import.meta.env.VITE_CHAT_FUNCTION_URL?.trim();
  if (!configuredChatFunctionUrl) {
    return {
      syncUrl: CHAT_FUNCTION_PATH,
      backgroundUrl: CHAT_BACKGROUND_FUNCTION_PATH,
      statusUrl: CHAT_STATUS_FUNCTION_PATH,
    };
  }

  const backgroundUrl = configuredChatFunctionUrl.replace(
    /\/chat(?:\/)?$/,
    "/chat-background",
  );
  const statusUrl = configuredChatFunctionUrl.replace(/\/chat(?:\/)?$/, "/chat-status");

  return {
    syncUrl: configuredChatFunctionUrl,
    backgroundUrl,
    statusUrl,
  };
};

const pollBackgroundJob = async ({
  statusUrl,
  jobId,
}: {
  statusUrl: string;
  jobId: string;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= BACKGROUND_MAX_POLL_MS) {
    const statusResponse = await fetch(`${statusUrl}?jobId=${encodeURIComponent(jobId)}`, {
      method: "GET",
    });
    const { data, rawBody } = await parseJsonSafely(statusResponse);

    if (!statusResponse.ok) {
      throw new Error(
        (typeof data.error === "string" && data.error) ||
          "Unable to fetch background job status.",
      );
    }

    const status = typeof data.status === "string" ? data.status : "queued";
    if (status === "completed") {
      const assistantText =
        typeof data.assistantText === "string" ? data.assistantText.trim() : "";
      if (!assistantText) {
        throw new Error("Response API returned an empty message.");
      }
      return {
        assistantText,
        conversationId:
          typeof data.conversationId === "string" ? data.conversationId : undefined,
      };
    }

    if (status === "failed") {
      throw new Error(
        (typeof data.error === "string" && data.error) ||
          "Background chat task failed.",
      );
    }

    if (rawBody.toLowerCase().includes("inactivity timeout")) {
      throw new Error("Background function status polling timed out.");
    }

    await sleep(BACKGROUND_POLL_INTERVAL_MS);
  }

  throw new Error(
    "The AI response is taking longer than expected. Please retry in a moment.",
  );
};

const sendMessageViaBrowserOpenAI = async ({
  conversationId,
  content,
  imageDataUrl,
  mealContext,
  mode,
}: {
  conversationId?: string;
  content: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode: ChatApiMode;
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
    model: DEFAULT_MODEL,
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

  const response = await client.responses.create(payload);
  const assistantText = extractAssistantText(
    response as unknown as {
      output_text?: string;
      output?: Array<{
        type?: string;
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    },
  );

  if (!assistantText) {
    throw new Error("Response API returned an empty message.");
  }

  return {
    conversationId: mode === "conversation" ? contextId ?? response.id : response.id,
    assistantText,
  };
};

export const sendMessageToAssistant = async ({
  conversationId,
  content,
  imageDataUrl,
  mealContext,
  mode = "responses",
}: {
  conversationId?: string;
  content: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode?: ChatApiMode;
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

  try {
    const urls = getFunctionBaseUrls();
    const jobId = createJobId();
    const payload = {
      jobId,
      conversationId,
      content: trimmedMessage,
      imageDataUrl: trimmedImageDataUrl,
      mealContext: mealContext?.trim() || undefined,
      mode,
    };

    const backgroundStartResponse = await fetch(urls.backgroundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Netlify background functions usually return 202 immediately.
    if (backgroundStartResponse.ok) {
      return await pollBackgroundJob({
        statusUrl: urls.statusUrl,
        jobId,
      });
    }

    // Fallback to synchronous function for environments where background
    // functions are unavailable (for example, some local setups).
    const syncResponse = await fetch(urls.syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        content: trimmedMessage,
        imageDataUrl: trimmedImageDataUrl,
        mealContext: mealContext?.trim() || undefined,
        mode,
      }),
    });
    const { data, rawBody } = await parseJsonSafely(syncResponse);

    if (!syncResponse.ok) {
      const maybeError = typeof data.error === "string" ? data.error : "";
      const bodyLower = rawBody.toLowerCase();
      if (
        syncResponse.status === 504 ||
        bodyLower.includes("gateway timeout") ||
        bodyLower.includes("inactivity timeout")
      ) {
        throw new Error(
          "The AI response timed out. Please retry. Background function may still be processing.",
        );
      }
      throw new Error(maybeError || "Chat request failed.");
    }

    const assistantText =
      typeof data.assistantText === "string" ? data.assistantText.trim() : "";
    if (!assistantText) {
      throw new Error("Response API returned an empty message.");
    }

    return {
      conversationId:
        typeof data.conversationId === "string" ? data.conversationId : undefined,
      assistantText,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      try {
        return await sendMessageViaBrowserOpenAI({
          conversationId,
          content: trimmedMessage,
          imageDataUrl: trimmedImageDataUrl,
          mealContext,
          mode,
        });
      } catch (fallbackError) {
        throw new Error(normalizeChatError(fallbackError));
      }
    }
    throw new Error(normalizeChatError(error));
  }
};
