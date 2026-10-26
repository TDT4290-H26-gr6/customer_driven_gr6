import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { setCompetenceGrant, setSectionGrant } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("legacy admin api", () => {
  it("setSectionGrant grants with PUT and revokes with DELETE", async () => {
    await setSectionGrant("role 1", "sec/1", true);
    await setSectionGrant("role 1", "sec/1", false);
    // Ids are escaped so they can't change the path.
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/admin/roles/role%201/sections/sec%2F1", {
      method: "PUT",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/admin/roles/role%201/sections/sec%2F1", {
      method: "DELETE",
    });
  });

  it("setCompetenceGrant grants with PUT and revokes with DELETE", async () => {
    await setCompetenceGrant("role-1", "c-1", true);
    await setCompetenceGrant("role-1", "c-1", false);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/admin/roles/role-1/competences/c-1", {
      method: "PUT",
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/admin/roles/role-1/competences/c-1", {
      method: "DELETE",
    });
  });
});
