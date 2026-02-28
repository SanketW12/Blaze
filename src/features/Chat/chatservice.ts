import OpenAI from "openai";

const MAX_MESSAGE_LENGTH = 4000;
export type ChatApiMode = "responses" | "conversation";

let openAIClient: OpenAI | null = null;

const getOpenAIClient = () => {
  if (openAIClient) return openAIClient;

  const apiKey = import.meta.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_API_KEY");
  }

  openAIClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  return openAIClient;
};

const getDefaultConversationId = () => {
  const conversationId = import.meta.env.VITE_CONVERSATION_ID;
  if (!conversationId) return undefined;
  const normalized = conversationId.trim().replace(/^['"]|['"]$/g, "");
  return normalized || undefined;
};

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
    // Response chaining expects a previous response id (typically starts with "resp_").
    if (candidateId?.startsWith("resp_")) return candidateId;
    return undefined;
  }

  if (candidateId?.startsWith("conv_")) return candidateId;
  const envConversationId = getDefaultConversationId();
  if (envConversationId?.startsWith("conv_")) return envConversationId;

  const client = getOpenAIClient();
  const conversationApi = (
    client as unknown as { conversations?: { create: () => Promise<{ id: string }> } }
  ).conversations;
  if (!conversationApi?.create) {
    throw new Error("Conversations API is unavailable in this SDK version.");
  }
  const conversation = await conversationApi.create();
  return conversation.id;
};

export const extractAssistantText = (response: {
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
    const client = getOpenAIClient();
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
            ...(trimmedMessage
              ? [{ type: "input_text" as const, text: trimmedMessage }]
              : []),
            ...(trimmedImageDataUrl
              ? [
                  {
                    type: "input_image" as const,
                    image_url: trimmedImageDataUrl,
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
  } catch (error) {
    throw new Error(normalizeChatError(error));
  }
};
