import { getStore } from "@netlify/blobs";

export type ChatJobStatus = "queued" | "processing" | "completed" | "failed";

export interface ChatJobRecord {
  status: ChatJobStatus;
  conversationId?: string;
  assistantText?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const CHAT_JOBS_STORE = "chat-jobs";

const getChatJobsStore = () => getStore(CHAT_JOBS_STORE);

export const writeChatJob = async (jobId: string, record: ChatJobRecord) => {
  const store = getChatJobsStore();
  await store.set(jobId, JSON.stringify(record));
};

export const readChatJob = async (jobId: string) => {
  const store = getChatJobsStore();
  const record = await store.get(jobId, { type: "json" });
  if (!record || typeof record !== "object") return null;
  return record as ChatJobRecord;
};
