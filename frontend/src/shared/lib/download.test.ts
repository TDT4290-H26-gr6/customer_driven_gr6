import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
});

describe("downloadBlob", () => {
  it("clicks a temporary link with the given filename, then cleans up the object URL", () => {
    const blob = new Blob(["a,b\r\n1,2\r\n"], { type: "text/csv" });
    const createElementSpy = vi.spyOn(document, "createElement");

    downloadBlob(blob, "aios-tests.csv");

    const link = createElementSpy.mock.results[0].value as HTMLAnchorElement;
    expect(link.download).toBe("aios-tests.csv");
    expect(link.href).toContain("blob:mock-url");
    expect(document.body.contains(link)).toBe(false); // removed again after the click
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    createElementSpy.mockRestore();
  });
});
