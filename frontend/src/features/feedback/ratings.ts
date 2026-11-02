/** The satisfaction scale, worst to best: one face per rating (MIN_RATING–MAX_RATING in the backend). */
export const RATINGS = [
  { value: 1, face: "😞", label: "Very unhappy" },
  { value: 2, face: "🙁", label: "Unhappy" },
  { value: 3, face: "😐", label: "Neutral" },
  { value: 4, face: "🙂", label: "Happy" },
  { value: 5, face: "😄", label: "Very happy" },
] as const;

export type Rating = (typeof RATINGS)[number]["value"];

export function ratingInfo(value: number) {
  return RATINGS.find((r) => r.value === value) ?? null;
}

/**
 * The median of the given ratings, or null without any. The median rather
 * than the mean: the scale is ordered faces, not measured amounts, and one
 * very unhappy tester shouldn't pull everyone's typical answer down. With an
 * even count it can land halfway between two faces (e.g. 3.5).
 */
export function medianRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sorted = [...ratings].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** How many chose each face, in scale order. */
export function ratingCounts(ratings: number[]) {
  return RATINGS.map((r) => ({ ...r, count: ratings.filter((v) => v === r.value).length }));
}
