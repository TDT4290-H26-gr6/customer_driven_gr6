// The adaptive route through a SAT — pure, no Prisma, so every rule is
// unit-testable. assessment.service.ts loads the questions and answers and
// asks this what comes next.
//
// Sections are taken one at a time, in a random order per attempt. Within a
// section the modules go level 1 → 4 (A1 … A4). Every question of a level is
// asked, unless the level can no longer be passed:
// - passed when all its questions are answered and the learner has
//   PASS_THRESHOLD of its points — they move up to the next level;
// - failed once PASS_THRESHOLD is out of reach even with every remaining
//   question right — the section ends there and the next section starts.
// Questions never asked (the rest of a failed level, and the levels above
// it) still count toward the scores, as 0 points (see assessment.service.ts).
//
// Questions already answered are history: they stay on the path, in the
// order they were first answered, whatever happens to their answers later.
// Going Back and changing an answer only changes its score — except that
// the next question is always worked out from the learner's *current*
// position (the level of their latest answered question), using their
// current answers. So only answering beyond what's been revealed changes
// which questions come.

/**
 * A level counts as passed at 60% of its points, once all are answered —
 * the same line as "weak" on the Competencies page (frontend's scoreBand.ts)
 * and WEAK_THRESHOLD in learningJourney.service.ts, so a level that reads as
 * "Good" or better also advances; one that reads "Weak" doesn't. Partial
 * credit (multiple-answer questions) adds up toward it.
 */
export const PASS_THRESHOLD = 0.6;

/** What an unanswered question is worth — every question is out of 1 point (see assessment.scoring.ts). */
const UNANSWERED_MAX_SCORE = 1;

/** Float slack, so a sum like 0.1 + 0.2 that lands a hair under the threshold still reaches it. */
const EPSILON = 1e-9;

export type PathModule = { id: string; level: number | null; questionIds: string[] };
export type PathSection = { id: string; modules: PathModule[] };
export type PathAnswer = {
  score: number | null;
  maxScore: number | null;
  /** When the question was first answered — editing an answer doesn't change it. */
  answeredAt: Date;
};

export type AssessmentPath = {
  /** Every answered question, in the order first answered. */
  answered: string[];
  /** The next question to ask, or null when the assessment is finished. */
  next: string | null;
};

export type LevelOutcome =
  { status: "passed" } | { status: "failed" } | { status: "open"; next: string };

/**
 * The answered questions (in the order first answered) and the next one:
 * carry on from the level of the latest answered question — that level if
 * it's still undecided, else the levels above it — then each section not
 * visited yet, in the given order. Answers to questions that aren't in
 * `sections` (deleted, or hidden from the learner's role) are ignored.
 */
export function buildPath(
  sections: PathSection[],
  answers: ReadonlyMap<string, PathAnswer>,
): AssessmentPath {
  const ordered = sections.map((s) => ({ ...s, modules: byLevel(s.modules) }));

  // Where each question sits: its section and module, and its place in the
  // full walk order (which breaks ties between answers saved at once).
  const position = new Map<string, { section: number; module: number; order: number }>();
  ordered.forEach((section, si) =>
    section.modules.forEach((module, mi) =>
      module.questionIds.forEach((id) =>
        position.set(id, { section: si, module: mi, order: position.size }),
      ),
    ),
  );

  const answered = [...answers.keys()]
    .filter((id) => position.has(id))
    .sort(
      (a, b) =>
        answers.get(a)!.answeredAt.getTime() - answers.get(b)!.answeredAt.getTime() ||
        position.get(a)!.order - position.get(b)!.order,
    );

  const latest = answered.at(-1);
  if (latest) {
    const { section, module } = position.get(latest)!;
    const next = continueSection(ordered[section], module, answers);
    if (next) return { answered, next };
  }

  const visited = new Set(answered.map((id) => position.get(id)!.section));
  for (let si = 0; si < ordered.length; si++) {
    if (visited.has(si)) continue;
    const next = continueSection(ordered[si], 0, answers);
    if (next) return { answered, next };
  }

  return { answered, next: null };
}

/** From module `from` upwards: the next question of the first undecided level, or null once the section is over (a level failed, or every level passed). */
function continueSection(
  section: PathSection,
  from: number,
  answers: ReadonlyMap<string, PathAnswer>,
): string | null {
  for (let mi = from; mi < section.modules.length; mi++) {
    const outcome = levelOutcome(section.modules[mi], answers);
    if (outcome.status === "open") return outcome.next;
    if (outcome.status === "failed") return null;
  }
  return null;
}

/**
 * Whether a level is passed, failed, or still open (and its next unanswered
 * question). A level stays open until every question is answered, unless
 * the threshold is already out of reach.
 */
export function levelOutcome(
  module: PathModule,
  answers: ReadonlyMap<string, Pick<PathAnswer, "score" | "maxScore">>,
): LevelOutcome {
  const { earned, needed, remaining, firstUnanswered } = levelPoints(module, answers);
  if (firstUnanswered) {
    return earned + remaining < needed
      ? { status: "failed" }
      : { status: "open", next: firstUnanswered };
  }
  return earned >= needed ? { status: "passed" } : { status: "failed" };
}

/**
 * A level's points so far: what's earned, what's needed to pass it, and
 * what the unanswered questions could still add. A level with nothing
 * scorable needs 0 — no gate.
 */
function levelPoints(
  module: PathModule,
  answers: ReadonlyMap<string, Pick<PathAnswer, "score" | "maxScore">>,
) {
  let earned = 0;
  let total = 0;
  let remaining = 0;
  let firstUnanswered: string | null = null;

  for (const id of module.questionIds) {
    const answer = answers.get(id);
    if (answer) {
      earned += answer.score ?? 0;
      total += answer.maxScore ?? 0;
    } else {
      total += UNANSWERED_MAX_SCORE;
      remaining += UNANSWERED_MAX_SCORE;
      firstUnanswered ??= id;
    }
  }

  return { earned, needed: PASS_THRESHOLD * total - EPSILON, remaining, firstUnanswered };
}

/**
 * A learner's skill level in a section: how many levels, from level 1 up
 * without a gap, they've passed — 0 if not even level 1. A level passed
 * above a failed or unanswered one (possible after editing an earlier
 * answer) doesn't count, since the levels build on each other. Here a level
 * counts as passed once its points reach the threshold, answered in full or
 * not — SATs taken while a passed level skipped its remaining questions
 * keep their level.
 */
export function skillLevel(
  modules: PathModule[],
  answers: ReadonlyMap<string, Pick<PathAnswer, "score" | "maxScore">>,
): number {
  let level = 0;
  for (const module of byLevel(modules)) {
    const { earned, needed } = levelPoints(module, answers);
    if (earned < needed) break;
    level++;
  }
  return level;
}

/** Level 1 → 4; modules without a level go last, in their given order. */
function byLevel(modules: PathModule[]): PathModule[] {
  return [...modules].sort((a, b) => (a.level ?? Infinity) - (b.level ?? Infinity));
}

/**
 * A repeatable pseudo-random generator from a string seed (FNV-1a hash into
 * mulberry32), so an attempt's section order and choice order stay the same
 * every time its path is fetched — resuming, going Back, or reloading.
 */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle with the given random source. Returns a new array. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
