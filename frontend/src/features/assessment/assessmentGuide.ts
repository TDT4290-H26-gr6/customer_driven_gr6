/**
 * The parts of the assessment page the guide points at. Each is marked in
 * AssessmentRunnerPage with a matching `data-guide` attribute, so the guide
 * finds them without the page passing refs around.
 */
export type GuideTarget = "progress" | "question" | "next" | "exit" | "help";

export type GuideStep = {
  /** What to highlight; null for a centred card with nothing highlighted. */
  target: GuideTarget | null;
  title: string;
  body: string;
  /** Short rules, shown as a list under the body. */
  rules?: string[];
};

type Options = {
  /**
   * Whether this assessment has a Back button. The full self-assessment
   * doesn't (an answer is final once the learner moves on); a partial
   * reassessment and a journey assessment do.
   */
  canGoBack: boolean;
};

/**
 * The steps of the "how the assessment works" guide: a welcome card with the
 * rules, then one box per control on the page, in the order a learner meets
 * them. Kept short on purpose: it opens before the first question.
 */
export function assessmentGuideSteps({ canGoBack }: Options): GuideStep[] {
  return [
    {
      target: null,
      title: "How the assessment works",
      body:
        "A quick tour of this page, which takes about half a minute. You can skip it now and " +
        "open it again at any time with the ? button.",
      rules: [
        "Answer honestly. This is a self-assessment, not an exam: your results decide what " +
          "the app suggests you learn next.",
        "Not sure? When a question offers “I don't know”, choose it instead of guessing.",
        canGoBack
          ? "You can go back to earlier questions in this assessment and change your answers."
          : "Once you press Next, your answer is final: you can't go back and change it.",
        "Your answers are saved as you go, so you can stop and continue later.",
      ],
    },
    {
      target: "progress",
      title: "Your progress",
      body:
        "The assessment is split into sections, and this bar shows which one you're on. How " +
        "many questions a section has depends on your answers, so some are shorter than others.",
    },
    {
      target: "question",
      title: "The question",
      body:
        "Read the question and choose your answer. The label at the top shows which skill " +
        "the question is about.",
    },
    {
      target: "next",
      title: "Moving on",
      body: canGoBack
        ? "When you've answered, press Next to save your answer and go on. Back takes you to " +
          "the previous question if you want to change an answer. The last question has Finish " +
          "instead of Next."
        : "When you've answered, press Next to save your answer and go on. You can't go back " +
          "to earlier questions, so check your answer before you press it. The last question " +
          "has Finish instead of Next.",
    },
    {
      target: "exit",
      title: "Taking a break",
      body:
        "Exit lets you choose Save & exit, to continue later from where you stopped, or abort " +
        "and delete your answers.",
    },
    {
      target: "help",
      title: "Need this again?",
      body: "Press ? at any time during an assessment to see this guide again.",
    },
  ];
}
