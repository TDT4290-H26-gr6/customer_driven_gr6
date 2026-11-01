/**
 * How a percentage reads: "weak" at or below 60% (the same line as the
 * dashboard's "Where you're lacking"), "good" up to 84%, "strong" above.
 * The page always shows the label as text too, so colour is never the only cue.
 */
export function scoreBand(percent: number): "weak" | "good" | "strong" {
  if (percent <= 60) return "weak";
  if (percent < 85) return "good";
  return "strong";
}

export const BAND_LABEL = { weak: "Weak", good: "Good", strong: "Strong" } as const;
