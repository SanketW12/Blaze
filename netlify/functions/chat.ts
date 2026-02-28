import OpenAI from "openai";

type ChatApiMode = "responses" | "conversation";

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

const getOrCreateContextId = async (client: OpenAI, id: string | undefined, mode: ChatApiMode) => {
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

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}") as {
      conversationId?: string;
      content?: string;
      imageDataUrl?: string;
      mealContext?: string;
      mode?: ChatApiMode;
    };

    const mode: ChatApiMode = payload.mode === "conversation" ? "conversation" : "responses";
    const trimmedMessage = payload.content?.trim() ?? "";
    const trimmedImageDataUrl = payload.imageDataUrl?.trim();

    if (!trimmedMessage && !trimmedImageDataUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Message or image is required." }),
      };
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Message is too long. Keep it under ${MAX_MESSAGE_LENGTH} characters.`,
        }),
      };
    }

    if (trimmedImageDataUrl && !trimmedImageDataUrl.startsWith("data:image/")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Attached image format is invalid." }),
      };
    }

    const client = getClient();
    const contextId = await getOrCreateContextId(client, payload.conversationId, mode);

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
            ...(trimmedMessage ? [{ type: "input_text" as const, text: trimmedMessage }] : []),
            ...(trimmedImageDataUrl
              ? [{ type: "input_image" as const, image_url: trimmedImageDataUrl, detail: "auto" as const }]
              : []),
          ],
        },
      ],
    };

    if (payload.mealContext?.trim()) {
      requestBody.instructions = payload.mealContext.trim();
    }

    if (mode === "conversation" && contextId) {
      requestBody.conversation = contextId;
    } else if (mode === "responses" && contextId) {
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
      statusCode: 200,
      body: JSON.stringify({
        conversationId: mode === "conversation" ? contextId ?? response.id : response.id,
        assistantText,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to send message right now.",
      }),
    };
  }
};
