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

/** AI-written advice on the learner's latest completed self-assessment. */
export type Advice = {
  summary: string;
  steps: AdviceStep[];
  /** The LLM that wrote it, e.g. "openai/gpt-oss-120b". */
  model: string;
  /** ISO timestamp. */
  generatedAt: string;
};
