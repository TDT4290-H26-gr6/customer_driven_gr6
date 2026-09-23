import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Source } from "./types";

/** Third-party courses/resources a learner can take to build a competence. */
export function getSources(): Promise<Source[]> {
  return apiFetch<Source[]>(endpoints.sources);
}
