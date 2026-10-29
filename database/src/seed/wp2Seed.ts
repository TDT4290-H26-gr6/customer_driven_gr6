import seedData from "./data/aios_wp2_seed.json";
import { createDatasetLoader } from "./datasetLoader";

// The real AIOS WP2 curriculum in data/aios_wp2_seed.json: sections A–E, the
// 20 modules (A1–E4) with their main and secondary competences, the 36
// competences, the four learning journeys (Athena, Hephaestus, Prometheus,
// Themis), and the self-assessment items delivered so far. Moodle links are
// placeholders (moodleCourseId + MOODLE_BASE_URL). Items of types the app
// can't render yet are kept in the file's `_pendingItems` and not loaded.
// Loaded when SEED_DATASET=wp2 — see seed/index.ts.
//
// Per AIOS_Competence_Mapping_5_Learning_Journeys_BETA.docx, the curriculum
// now has a fifth journey, Apollo (Open Academic Research and Scholarly
// Communication), not yet added here: the doc gives no explicit module
// list for it (only "research-oriented modules in A and B, appropriate D,
// applied E4"), deferring to a WP3 curriculum journey table we don't have
// yet. Add it once that table exists, rather than guessing its section
// coverage. The journey ids below also don't line up with the doc's LJ
// numbering (e.g. "LJ3 - Hephaestus" keeps id journey-wp2-lj2): each kept
// the id of the single closest predecessor journey it most directly
// continues, so existing History/Advice rows referencing it stay
// meaningful rather than orphaned.

export const wp2Dataset = createDatasetLoader(seedData);
