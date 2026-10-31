import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";

// LEGACY, see pages/RoleVisibilityPage.tsx. getVisibility stays in ../api.ts
// because the drop-off section filter still reads the section list from it.

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
