/** The "I don't know" choice's value, IDK_VALUE in backend/src/modules/assessment/assessment.scoring.ts. */
export const IDK_VALUE = "__idk__";

type ChoiceSession = { id?: string; data?: { id?: string; value?: unknown }[] };

/**
 * "I don't know" excludes every other choice: if it's ticked alongside others,
 * returns a copy of the session holding only it. Returns the session itself
 * when there's nothing to clear (or it isn't a choice session).
 */
export function clearOthersIfIdk(session: unknown): unknown {
  const data = (session as ChoiceSession | null | undefined)?.data;
  if (!Array.isArray(data)) return session;
  const needsClearing = data.some(
    (d) => Array.isArray(d.value) && d.value.includes(IDK_VALUE) && d.value.length > 1,
  );
  if (!needsClearing) return session;
  return {
    ...(session as ChoiceSession),
    data: data.map((d) =>
      Array.isArray(d.value) && d.value.includes(IDK_VALUE) ? { ...d, value: [IDK_VALUE] } : d,
    ),
  };
}
