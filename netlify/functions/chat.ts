import { normalizeChatPayload, runChatCompletion } from "./chat-core";

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const payload = normalizeChatPayload(JSON.parse(event.body || "{}"));
    const result = await runChatCompletion(payload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        conversationId: result.conversationId,
        assistantText: result.assistantText,
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
