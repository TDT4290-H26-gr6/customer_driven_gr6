import type { LearningJourney } from "../types";

// How a journey is shown, shared by its card and its details modal.

// Banner colour per card: a stand-in "picture" until real artwork exists.
// Cycled by the card's position in the list rather than derived from the
// journey. One gradient per journey (5, matching the 5 WP3 journeys), a
// spectrum from purple through blue to green, so every card gets a distinct
// colour rather than repeating. The gradients themselves are the
// --banner-gradient-* tokens in styles/globals.css; keep this count in sync
// with them.
const BANNER_GRADIENT_COUNT = 5;

export function bannerGradient(index: number): string {
  return `var(--banner-gradient-${(index % BANNER_GRADIENT_COUNT) + 1})`;
}

export const COVERAGE_LABEL = { M: "Core", R: "Recommended", S: "Selective" } as const;
const COVERAGE_ORDER = { M: 0, R: 1, S: 2 } as const;

/** "LJ2 - Research Data …" -> code "LJ2" and title "Research Data …"; otherwise just a title. */
export function splitName(name: string): { code: string | null; title: string } {
  const match = name.match(/^(LJ\d+)\s+[—-]\s+(.+)$/);
  return match ? { code: match[1], title: match[2] } : { code: null, title: name };
}

/** The sections the journey covers, core (M) first, then A–E. */
export function sortedSections(journey: LearningJourney) {
  return [...(journey.sections ?? [])]
    .filter((s) => s.coverageLevel)
    .sort(
      (a, b) =>
        COVERAGE_ORDER[a.coverageLevel!] - COVERAGE_ORDER[b.coverageLevel!] ||
        (a.section?.code ?? "").localeCompare(b.section?.code ?? ""),
    );
}

/** Codes of the core (M) sections, sorted: what a journey assessment asks about. */
export function coreSectionCodes(journey: LearningJourney): string[] {
  return sortedSections(journey)
    .filter((s) => s.coverageLevel === "M")
    .map((s) => s.section?.code ?? s.section?.name ?? "")
    .filter(Boolean)
    .sort();
}
