import type { Feedback, Learner } from "@prisma/client";

export type FeedbackInput = {
  message: string;
  suggestion: string | null;
  page: string | null;
};

export type FeedbackWithLearner = Feedback & { learner: Pick<Learner, "email" | "name"> };

export type FeedbackDto = {
  id: string;
  message: string;
  suggestion: string | null;
  page: string | null;
  createdAt: Date;
  learner: { email: string | null; name: string | null }; // both null once the sender's account is deleted
};

export const MAX_FEEDBACK_LENGTH = 2000;
/** An app path like "/dashboard/details" — 191 is Prisma's MySQL VARCHAR. */
const MAX_PAGE_LENGTH = 191;

/**
 * Validates a POST /feedback body: `message` is required, `suggestion` and
 * `page` are optional. Text is trimmed and a blank optional field becomes
 * null — pure so it's unit-testable without a request/response pair.
 */
export function validateFeedbackInput(body: unknown): { data: FeedbackInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body" };
  const { message, suggestion, page } = body as Record<string, unknown>;

  if (typeof message !== "string" || message.trim() === "") {
    return { error: "Please describe what should be improved" };
  }
  if (message.length > MAX_FEEDBACK_LENGTH) return { error: "message is too long" };

  if (suggestion !== undefined && suggestion !== null) {
    if (typeof suggestion !== "string") return { error: "suggestion must be a string" };
    if (suggestion.length > MAX_FEEDBACK_LENGTH) return { error: "suggestion is too long" };
  }

  if (page !== undefined && page !== null) {
    if (typeof page !== "string") return { error: "page must be a string" };
    if (page.length > MAX_PAGE_LENGTH) return { error: "page is too long" };
  }

  return {
    data: {
      message: message.trim(),
      suggestion: (suggestion as string | null | undefined)?.trim() || null,
      page: (page as string | null | undefined)?.trim() || null,
    },
  };
}

export function toFeedbackDto(feedback: FeedbackWithLearner): FeedbackDto {
  return {
    id: feedback.id,
    message: feedback.message,
    suggestion: feedback.suggestion,
    page: feedback.page,
    createdAt: feedback.createdAt,
    learner: { email: feedback.learner.email, name: feedback.learner.name },
  };
}
