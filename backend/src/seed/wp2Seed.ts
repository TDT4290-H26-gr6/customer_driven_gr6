import seedData from "./data/aios_wp2_seed.json";
import { createDatasetLoader } from "./datasetLoader";

// The real AIOS WP2 curriculum in data/aios_wp2_seed.json: sections A–E, the
// 20 modules (A1–E4) with their main and secondary competences, the 36
// competences, the six learning journeys, and the self-assessment items
// delivered so far. Moodle links are placeholders (moodleCourseId +
// MOODLE_BASE_URL). Items of types the app can't render yet are kept in the
// file's `_pendingItems` and not loaded. Loaded when SEED_DATASET=wp2 — see
// seed/index.ts.

export const wp2Dataset = createDatasetLoader(seedData);
