import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { downloadBlob } from "@/shared/lib/download";
import type { DropoffData, DropoffFilters, VisibilityMatrix } from "./types";

/** Every role, section and competence, plus which roles are granted which. */
export function getVisibility(): Promise<VisibilityMatrix> {
  return apiFetch<VisibilityMatrix>(endpoints.admin.visibility);
}

/**
 * Downloads the CD-23 analysis exports: one row per completed full
 * assessment ("tests"), and one row per answered question in one
 * ("questions") — linked by satInstanceId. No learner is identifiable from
 * either file.
 */
export async function downloadTestsCsv(): Promise<void> {
  const blob = await apiFetch<Blob>(endpoints.admin.statsTests, { responseType: "blob" });
  downloadBlob(blob, "aios-tests.csv");
}

export async function downloadQuestionsCsv(): Promise<void> {
  const blob = await apiFetch<Blob>(endpoints.admin.statsQuestions, { responseType: "blob" });
  downloadBlob(blob, "aios-question-times.csv");
}

/** Where learners stop answering: aggregates over abandoned and completed assessments. */
export function getDropoff(filters: DropoffFilters): Promise<DropoffData> {
  const params = new URLSearchParams({
    type: filters.type,
    inactiveDays: String(filters.inactiveDays),
  });
  if (filters.sectionId) params.set("sectionId", filters.sectionId);
  if (filters.from) params.set("from", `${filters.from}T00:00:00.000Z`);
  // Inclusive of the chosen day.
  if (filters.to) params.set("to", `${filters.to}T23:59:59.999Z`);
  return apiFetch<DropoffData>(`${endpoints.admin.dropoff}?${params.toString()}`);
}
