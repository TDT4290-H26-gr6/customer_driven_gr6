import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Role } from "./types";

/** Selectable roles for the onboarding dropdown. */
export function getRoles(): Promise<Role[]> {
  return apiFetch<Role[]>(endpoints.roles);
}

/** Persist the signed-in learner's chosen role. */
export function setMyRole(roleId: string): Promise<{ role: Role }> {
  return apiFetch<{ role: Role }>(endpoints.auth.myRole, {
    method: "PUT",
    body: { roleId },
  });
}
