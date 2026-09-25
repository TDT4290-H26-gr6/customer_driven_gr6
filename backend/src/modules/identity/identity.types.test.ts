import { describe, expect, it } from "vitest";
import { toLearnerDto, type LearnerWithRole } from "./identity.types";

function learner(overrides: Partial<LearnerWithRole> = {}): LearnerWithRole {
  return {
    id: "learner-1",
    email: "learner@example.com",
    name: "Ada Lovelace",
    googleSubId: "sub-1",
    roleId: "role-1",
    userRole: {
      id: "role-1",
      name: "Student",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    hasCompletedInitialAssessment: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("toLearnerDto", () => {
  it("maps userRole to role and keeps the public-facing fields", () => {
    const dto = toLearnerDto(learner());

    expect(dto).toEqual({
      id: "learner-1",
      email: "learner@example.com",
      name: "Ada Lovelace",
      role: {
        id: "role-1",
        name: "Student",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      hasCompletedInitialAssessment: false,
    });
  });

  it("carries role as null when no persona has been picked yet", () => {
    const dto = toLearnerDto(learner({ userRole: null, roleId: null }));
    expect(dto.role).toBeNull();
  });
});
