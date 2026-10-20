import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken } from "./token";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("session token storage", () => {
  it("stores, reads and clears the token", () => {
    expect(getToken()).toBeNull();
    setToken("session-jwt");
    expect(getToken()).toBe("session-jwt");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("degrades quietly when storage is unavailable (e.g. blocked in a private window)", () => {
    const blocked = () => {
      throw new DOMException("denied", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    expect(() => setToken("session-jwt")).not.toThrow();
    expect(getToken()).toBeNull();
    expect(() => clearToken()).not.toThrow();
  });
});
