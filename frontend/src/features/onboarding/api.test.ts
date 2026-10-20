import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/shared/api/client";
import { getRoles, setMyRole } from "./api";

vi.mock("@/shared/api/client", () => ({ apiFetch: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

it("getRoles fetches the roles to choose from", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce([{ id: "role-1", name: "Data steward" }]);
  expect(await getRoles()).toEqual([{ id: "role-1", name: "Data steward" }]);
  expect(apiFetch).toHaveBeenCalledWith("/roles");
});

it("setMyRole saves the chosen role", async () => {
  await setMyRole("role-1");
  expect(apiFetch).toHaveBeenCalledWith("/auth/me/role", {
    method: "PUT",
    body: { roleId: "role-1" },
  });
});
