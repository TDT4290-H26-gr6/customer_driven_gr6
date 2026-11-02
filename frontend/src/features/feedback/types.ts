export type FeedbackInput = {
  /** What should be improved; may be null when a rating is given. */
  message: string | null;
  suggestion: string | null;
  /** App path the tester was on when they wrote it, e.g. "/dashboard". */
  page: string | null;
  /** Overall satisfaction, 1 (very unhappy) to 5 (very happy), see ratings.ts. */
  rating: number | null;
};

/** One piece of feedback as the team sees it in admin mode. */
export type Feedback = {
  id: string;
  message: string | null;
  rating: number | null;
  suggestion: string | null;
  page: string | null;
  /** ISO timestamp. */
  createdAt: string;
  learner: { email: string | null; name: string | null }; // both null once the sender's account is deleted
};

/** Server-side cap on each text field, mirrored so the form can show a counter. */
export const MAX_FEEDBACK_LENGTH = 2000;
