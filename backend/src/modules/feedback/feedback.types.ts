import type { Feedback, Learner } from "@prisma/client";

export type FeedbackInput = {
  message: string | null;
  suggestion: string | null;
  page: string | null;
  /** Overall satisfaction, MIN_RATING (very unhappy) to MAX_RATING (very happy). */
  rating: number | null;
};

export type FeedbackWithLearner = Feedback & { learner: Pick<Learner, "email" | "name"> };

export type FeedbackDto = {
  id: string;
  message: string | null;
  suggestion: string | null;
  page: string | null;
  rating: number | null;
  createdAt: Date;
  learner: { email: string | null; name: string | null }; // both null once the sender's account is deleted
};

export const MAX_FEEDBACK_LENGTH = 2000;
/** The satisfaction scale, one face per step. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;
/** An app path like "/dashboard/details", 191 is Prisma's MySQL VARCHAR. */
const MAX_PAGE_LENGTH = 191;

/**
 * Validates a POST /feedback body: a `message` (what should be improved), a
 * `rating` (overall satisfaction) or both, plus an optional `suggestion` and
 * `page`. Text is trimmed and a blank text field becomes null, pure so it's
 * unit-testable without a request/response pair.
 */
export function validateFeedbackInput(body: unknown): { data: FeedbackInput } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Invalid request body" };
  const { message, suggestion, page, rating } = body as Record<string, unknown>;

  for (const [name, value] of [
    ["message", message],
    ["suggestion", suggestion],
    ["page", page],
  ] as const) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return { error: `${name} must be a string` };
    const max = name === "page" ? MAX_PAGE_LENGTH : MAX_FEEDBACK_LENGTH;
    if (value.length > max) return { error: `${name} is too long` };
  }

  if (
    rating !== undefined &&
    rating !== null &&
    !(
      Number.isInteger(rating) &&
      (rating as number) >= MIN_RATING &&
      (rating as number) <= MAX_RATING
    )
  ) {
    return { error: `rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}` };
  }

  const text = (value: unknown) => (value as string | null | undefined)?.trim() || null;
  const data: FeedbackInput = {
    message: text(message),
    suggestion: text(suggestion),
    page: text(page),
    rating: (rating as number | null | undefined) ?? null,
  };
  if (data.message === null && data.rating === null) {
    return { error: "Please choose how satisfied you are, or describe what should be improved" };
  }
  return { data };
}

export function toFeedbackDto(feedback: FeedbackWithLearner): FeedbackDto {
  return {
    id: feedback.id,
    message: feedback.message,
    suggestion: feedback.suggestion,
    page: feedback.page,
    rating: feedback.rating,
    createdAt: feedback.createdAt,
    learner: { email: feedback.learner.email, name: feedback.learner.name },
  };
}
