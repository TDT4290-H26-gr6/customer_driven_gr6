import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import { downloadBlob } from "@/shared/lib/download";
import type { VisibilityMatrix } from "./types";

/** Every role, section and competence, plus which roles are granted which. */
export function getVisibility(): Promise<VisibilityMatrix> {
  return apiFetch<VisibilityMatrix>(endpoints.admin.visibility);
}

/** Grants (`granted: true`) or revokes a role's visibility of a section. */
export function setSectionGrant(
  roleId: string,
  sectionId: string,
  granted: boolean,
): Promise<void> {
  return apiFetch<void>(endpoints.admin.roleSection(roleId, sectionId), {
    method: granted ? "PUT" : "DELETE",
  });
}

/** Grants (`granted: true`) or revokes a role's visibility of a competence. */
export function setCompetenceGrant(
  roleId: string,
  competenceId: string,
  granted: boolean,
): Promise<void> {
  return apiFetch<void>(endpoints.admin.roleCompetence(roleId, competenceId), {
    method: granted ? "PUT" : "DELETE",
  });
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
