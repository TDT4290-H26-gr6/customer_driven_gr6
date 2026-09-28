import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Feedback, FeedbackInput } from "./types";

export function sendFeedback(input: FeedbackInput): Promise<void> {
  return apiFetch<void>(endpoints.feedback, { method: "POST", body: input });
}

/** Everything testers have sent, newest first (admin only). */
export function getAllFeedback(): Promise<Feedback[]> {
  return apiFetch<Feedback[]>(endpoints.admin.feedback);
}
