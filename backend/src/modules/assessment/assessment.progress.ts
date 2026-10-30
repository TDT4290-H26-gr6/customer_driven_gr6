// Pure progress logic for the dashboard, no Prisma, so it's unit-testable
// directly (same pattern as assessment.scoring.ts). assessment.service.ts
// loads the attempts and calls this.

/** The parts of one completed SAT's per-section results (getAttemptSectionScores) used here. */
export type AttemptForProgress = {
  instanceNum: number;
  sections: {
    section: { id: string; code: string | null; name: string };
    assessed: boolean;
    level: number | null;
    levelCount: number;
    competences: { competence: { id: string }; score: number; maxScore: number; reached: boolean }[];
  }[];
};

/** A section's result as of some assessment, and which SAT it actually comes from. */
export type SectionSnapshot = {
  /** The SAT that last assessed this section, older than the one it's "as of" when carried over. */
  instanceNum: number;
  score: number;
  maxScore: number;
  /** Levels passed from the bottom up (0 = not even the first). */
  level: number | null;
};

export type SectionProgress = {
  section: { id: string; code: string | null; name: string };
  levelCount: number;
  /** As of the latest assessment; null if no assessment has covered the section yet. */
  latest: SectionSnapshot | null;
  /** As of the assessment before it; null when there's no earlier one, or it hadn't covered the section. */
  previous: SectionSnapshot | null;
};

/**
 * Each section's last known result as of one assessment. The level reached
 * (and which SAT this "is" for display purposes) comes from the newest SAT
 * that assessed the section at all, a reassessment after a learning
 * journey only covers some sections, and the others keep their earlier
 * level rather than dropping to nothing. But the score is built up
 * competence by competence, each from the newest SAT that actually reached
 * it: a SAT that barely touched a section (e.g. failed its first level)
 * still marks the section "assessed", and zero-fills every competence it
 * never got to in its own report, without this, that zero-fill would
 * shadow real, better data an earlier SAT already has for the rest of the
 * section. A competence no SAT has ever reached is left out entirely
 * (matches the Competencies page, which only averages assessed modules).
 */
export function snapshotAsOf(
  attemptsNewestFirst: AttemptForProgress[],
  instanceNum: number,
): Map<string, SectionSnapshot> {
  const snapshot = new Map<string, SectionSnapshot>();
  const reachedCompetences = new Map<string, Set<string>>(); // sectionId -> competenceIds already counted

  for (const attempt of attemptsNewestFirst) {
    if (attempt.instanceNum > instanceNum) continue;
    for (const s of attempt.sections) {
      if (!s.assessed) continue;
      if (!snapshot.has(s.section.id)) {
        snapshot.set(s.section.id, {
          instanceNum: attempt.instanceNum,
          score: 0,
          maxScore: 0,
          level: s.level,
        });
      }
      const entry = snapshot.get(s.section.id)!;
      const seen = reachedCompetences.get(s.section.id) ?? new Set<string>();
      reachedCompetences.set(s.section.id, seen);

      for (const c of s.competences) {
        if (!c.reached || seen.has(c.competence.id)) continue;
        seen.add(c.competence.id);
        entry.score += c.score;
        entry.maxScore += c.maxScore;
      }
    }
  }
  return snapshot;
}

/**
 * Every section with its result as of the latest assessment and as of the
 * one before it. Sections come in the newest attempt's order (A–E), then any
 * only an older attempt had.
 */
export function buildSectionProgress(
  attemptsNewestFirst: AttemptForProgress[],
  latestInstanceNum: number,
  previousInstanceNum: number | null,
): SectionProgress[] {
  const latest = snapshotAsOf(attemptsNewestFirst, latestInstanceNum);
  const previous =
    previousInstanceNum === null
      ? new Map<string, SectionSnapshot>()
      : snapshotAsOf(attemptsNewestFirst, previousInstanceNum);

  const sections = new Map<string, { section: SectionProgress["section"]; levelCount: number }>();
  for (const attempt of attemptsNewestFirst) {
    for (const s of attempt.sections) {
      if (!sections.has(s.section.id)) {
        sections.set(s.section.id, { section: s.section, levelCount: s.levelCount });
      }
    }
  }

  return [...sections.values()].map(({ section, levelCount }) => ({
    section,
    levelCount,
    latest: latest.get(section.id) ?? null,
    previous: previous.get(section.id) ?? null,
  }));
}
