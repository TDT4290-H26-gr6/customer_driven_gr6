import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IDK_LABEL, IDK_VALUE } from "./assessment.scoring";
import * as pie from "./assessment.pie";

// assessment.pie.ts is a copy of database/src/seed/pie.ts: db-init builds the
// seeded questions with that one, the curriculum editor builds edited ones
// with this one, and both must come out the same so they render and score
// alike. The packages can't import from each other, so the copies are kept
// identical instead: change database/src/seed/pie.ts and copy it here.
describe("assessment.pie.ts", () => {
  it("is identical to database/src/seed/pie.ts", () => {
    const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
    expect(read("assessment.pie.ts")).toBe(read("../../../../database/src/seed/pie.ts"));
  });

  it("uses the same I don't know choice the scoring gives 0", () => {
    expect(pie.IDK_VALUE).toBe(IDK_VALUE);
    expect(pie.IDK_LABEL).toBe(IDK_LABEL);
  });
});
