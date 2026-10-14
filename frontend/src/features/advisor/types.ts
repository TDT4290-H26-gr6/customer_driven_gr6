/** One recommended next step, with why it was picked for this learner. */
export type AdviceStep = {
  /**
   * "moodle_module": a curriculum module (e.g. A2) in Moodle; "module": a step
   * in the recommended journey; "source": a learning resource.
   */
  kind: "moodle_module" | "module" | "source";
  title: string;
  /** Where to take it (a Moodle course), when known. */
  url: string | null;
  reason: string;
};

/** The learning journey the advisor chose for the learner, as the journey card shows it. */
export type AdviceJourney = {
  id: string;
  name: string;
  description: string | null;
  /** Its page in Moodle (placeholder until the real page exists). */
  moodleUrl: string | null;
  modules: { id: string; order: number; title: string; description: string | null }[];
};

/** AI-written advice on the learner's latest completed self-assessment. */
export type Advice = {
  summary: string;
  steps: AdviceStep[];
  /**
   * The journeys that fit the learner best — ranked by the AI on their
   * scores and profile, best first, up to two — among those covering their
   * weak areas. Each reason is null when the app filled it in from the
   * score-based order. Empty when there was none to choose from.
   */
  journeys: { journey: AdviceJourney; reason: string | null }[];
  /** The LLM that wrote it, e.g. "openai/gpt-oss-120b". */
  model: string;
  /** ISO timestamp. */
  generatedAt: string;
};
