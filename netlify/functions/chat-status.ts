import { readChatJob } from "./chat-job-store";

const getJobIdFromQuery = (rawQueryStringParameters: unknown) => {
  if (!rawQueryStringParameters || typeof rawQueryStringParameters !== "object") {
    return "";
  }
  const query = rawQueryStringParameters as Record<string, unknown>;
  return typeof query.jobId === "string" ? query.jobId.trim() : "";
};

export const handler = async (event: {
  httpMethod: string;
  queryStringParameters?: Record<string, string>;
}) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const jobId = getJobIdFromQuery(event.queryStringParameters);
  if (!jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "jobId is required." }),
    };
  }

  const job = await readChatJob(jobId);
  if (!job) {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: "queued" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(job),
  };
};
