import OpenAI from "openai";

export type ChatApiMode = "responses" | "conversation";

export interface ChatPayload {
  conversationId?: string;
  content?: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode?: ChatApiMode;
}

export interface NormalizedChatPayload {
  conversationId?: string;
  content: string;
  imageDataUrl?: string;
  mealContext?: string;
  mode: ChatApiMode;
}

export interface ChatResult {
  conversationId?: string;
  assistantText: string;
}

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const getDefaultConversationId = () => {
  const value = process.env.OPENAI_CONVERSATION_ID;
  if (!value) return undefined;
  const normalized = value.trim().replace(/^['"]|['"]$/g, "");
  return normalized || undefined;
};

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey });
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
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return textParts.join("\n").trim();
};

const getOrCreateContextId = async (
  client: OpenAI,
  id: string | undefined,
  mode: ChatApiMode,
) => {
  const candidateId = id?.trim();
  if (mode === "responses") {
    return candidateId?.startsWith("resp_") ? candidateId : undefined;
  }

  if (candidateId?.startsWith("conv_")) return candidateId;
  const defaultConversation = getDefaultConversationId();
  if (defaultConversation?.startsWith("conv_")) return defaultConversation;

  const conversationApi = (
    client as unknown as { conversations?: { create: () => Promise<{ id: string }> } }
  ).conversations;
  if (!conversationApi?.create) {
    throw new Error("Conversations API is unavailable in this SDK version.");
  }
  const created = await conversationApi.create();
  return created.id;
};

export const normalizeChatPayload = (
  payload: ChatPayload,
): NormalizedChatPayload => {
  const mode: ChatApiMode = payload.mode === "conversation" ? "conversation" : "responses";
  const content = payload.content?.trim() ?? "";
  const imageDataUrl = payload.imageDataUrl?.trim();
  const mealContext = payload.mealContext?.trim() || undefined;

  if (!content && !imageDataUrl) {
    throw new Error("Message or image is required.");
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message is too long. Keep it under ${MAX_MESSAGE_LENGTH} characters.`);
  }
  if (imageDataUrl && !imageDataUrl.startsWith("data:image/")) {
    throw new Error("Attached image format is invalid.");
  }

  return {
    conversationId: payload.conversationId?.trim() || undefined,
    content,
    imageDataUrl,
    mealContext,
    mode,
  };
};

export const runChatCompletion = async (
  payload: NormalizedChatPayload,
): Promise<ChatResult> => {
  const client = getClient();
  const contextId = await getOrCreateContextId(client, payload.conversationId, payload.mode);

  const requestBody: {
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
          ...(payload.content ? [{ type: "input_text" as const, text: payload.content }] : []),
          ...(payload.imageDataUrl
            ? [
                {
                  type: "input_image" as const,
                  image_url: payload.imageDataUrl,
                  detail: "auto" as const,
                },
              ]
            : []),
        ],
      },
    ],
  };

  if (payload.mealContext) {
    requestBody.instructions = payload.mealContext;
  }

  if (payload.mode === "conversation" && contextId) {
    requestBody.conversation = contextId;
  } else if (payload.mode === "responses" && contextId) {
    requestBody.previous_response_id = contextId;
  }

  const response = await client.responses.create(requestBody);
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
    conversationId: payload.mode === "conversation" ? contextId ?? response.id : response.id,
    assistantText,
  };
};
