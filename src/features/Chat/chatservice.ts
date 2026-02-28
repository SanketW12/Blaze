const MAX_MESSAGE_LENGTH = 4000;
export type ChatApiMode = "responses" | "conversation";
const CHAT_FUNCTION_PATH = "/.netlify/functions/chat";
const DEFAULT_MODEL = "gpt-4o-mini";

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
    const baseUrl = import.meta.env.VITE_CHAT_FUNCTION_URL?.trim() || CHAT_FUNCTION_PATH;
    const response = await fetch(baseUrl, {
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

    const data = (await response.json()) as {
      error?: string;
      assistantText?: string;
      conversationId?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Chat request failed.");
    }
    if (!data.assistantText?.trim()) {
      throw new Error("Response API returned an empty message.");
    }

    return {
      conversationId: data.conversationId,
      assistantText: data.assistantText,
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
