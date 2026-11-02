import seedData from "./data/aios_wp2_seed.json";
import { createDatasetLoader } from "./datasetLoader";

// The real AIOS WP2 curriculum in data/aios_wp2_seed.json: sections A–E, the
// 20 modules (A1–E4) with their main and secondary competences, the 36
// competences, the five WP3-revised learning journeys (Athena, Apollo,
// Hephaestus, Prometheus, Themis), and the self-assessment items delivered
// so far, the matrix and matching items included. Moodle links are
// placeholders (moodleCourseId + MOODLE_BASE_URL). db-init loads it into an
// empty database, see seed/index.ts.
//
// The journey ids don't line up with AIOS_Competence_Mapping_5_Learning_
// Journeys_BETA.docx's LJ numbering (e.g. "LJ3 - Hephaestus" keeps id
// journey-wp2-lj2): each consolidated journey kept the id of the single
// closest predecessor it most directly continues, so existing History/
// Advice rows referencing it stay meaningful rather than orphaned. Apollo
// has no predecessor (it's new, not a consolidation), so it took the next
// free slot, journey-wp2-lj3.
//
// Apollo's section coverage (A=M, B=M, C=S, D=R, E=R) is a provisional
// guess: the doc gives no explicit module list for it (only "research-
// oriented modules in A and B, appropriate D, applied E4"), deferring to a
// WP3 curriculum journey table we don't have. Correct it once that table
// is available.

export const wp2Dataset = createDatasetLoader(seedData);
