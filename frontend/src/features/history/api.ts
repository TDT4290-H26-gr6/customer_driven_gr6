import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { SatHistoryEntry } from "./types";

/** Every completed self-assessment, oldest first, so a learner can see how they've progressed. */
export function getSatHistory(): Promise<SatHistoryEntry[]> {
  return apiFetch<SatHistoryEntry[]>(endpoints.assessment.history);
}
