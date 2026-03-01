import { normalizeChatPayload, runChatCompletion } from "./chat-core";
import { writeChatJob } from "./chat-job-store";

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const now = new Date().toISOString();
  let jobId = "";

  try {
    const rawPayload = JSON.parse(event.body || "{}") as {
      jobId?: string;
    };

    jobId = rawPayload.jobId?.trim() || "";
    if (!jobId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "jobId is required." }),
      };
    }

    await writeChatJob(jobId, {
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });

    const payload = normalizeChatPayload(rawPayload);
    const result = await runChatCompletion(payload);

    await writeChatJob(jobId, {
      status: "completed",
      conversationId: result.conversationId,
      assistantText: result.assistantText,
      createdAt: now,
      updatedAt: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, jobId }),
    };
  } catch (error) {
    if (jobId) {
      await writeChatJob(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unable to send message right now.",
        createdAt: now,
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, jobId }),
    };
  }
};
