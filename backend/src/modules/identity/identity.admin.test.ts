import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./identity.admin";

describe("isAdminEmail", () => {
  it("lets everyone in when ADMIN_EMAILS is unset in development", () => {
    expect(isAdminEmail("anyone@example.com", "everyone")).toBe(true);
  });

  it("only lets listed emails in, ignoring case", () => {
    const admins = ["admin@ntnu.no"];

    expect(isAdminEmail("admin@ntnu.no", admins)).toBe(true);
    expect(isAdminEmail("Admin@NTNU.no", admins)).toBe(true);
    expect(isAdminEmail("student@ntnu.no", admins)).toBe(false);
  });

  it("lets nobody in with an empty list (production without ADMIN_EMAILS)", () => {
    expect(isAdminEmail("admin@ntnu.no", [])).toBe(false);
  });
});
