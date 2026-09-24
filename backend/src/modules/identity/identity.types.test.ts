import { describe, expect, it } from "vitest";
import { toLearnerDto, validateProfileInput, type LearnerWithRole } from "./identity.types";

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

describe("validateProfileInput", () => {
  it("accepts a fully filled-in body", () => {
    const result = validateProfileInput({
      goals: "Get better at data management",
      background: "PhD student, biology",
      yearsOfExperience: 3,
    });
    expect(result).toEqual({
      data: {
        goals: "Get better at data management",
        background: "PhD student, biology",
        yearsOfExperience: 3,
      },
    });
  });

  it("accepts an empty body — every field is optional", () => {
    const result = validateProfileInput({});
    expect(result).toEqual({
      data: { goals: undefined, background: undefined, yearsOfExperience: undefined },
    });
  });

  it("accepts explicit nulls, e.g. clearing a previously saved field", () => {
    const result = validateProfileInput({ goals: null });
    expect("data" in result && result.data.goals).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(validateProfileInput(null)).toEqual({ error: "Invalid request body" });
    expect(validateProfileInput("nope")).toEqual({ error: "Invalid request body" });
  });

  it("rejects a non-string goals/background", () => {
    expect(validateProfileInput({ goals: 123 })).toEqual({ error: "goals must be a string" });
    expect(validateProfileInput({ background: true })).toEqual({
      error: "background must be a string",
    });
  });

  it("rejects text over the length cap", () => {
    const result = validateProfileInput({ goals: "x".repeat(2001) });
    expect(result).toEqual({ error: "goals is too long" });
  });

  it("rejects a non-integer or negative yearsOfExperience", () => {
    expect(validateProfileInput({ yearsOfExperience: "3" })).toEqual({
      error: "yearsOfExperience must be a whole number",
    });
    expect(validateProfileInput({ yearsOfExperience: 2.5 })).toEqual({
      error: "yearsOfExperience must be a whole number",
    });
    expect(validateProfileInput({ yearsOfExperience: -1 })).toEqual({
      error: "yearsOfExperience must be between 0 and 80",
    });
  });

  it("rejects an implausibly large yearsOfExperience", () => {
    expect(validateProfileInput({ yearsOfExperience: 81 })).toEqual({
      error: "yearsOfExperience must be between 0 and 80",
    });
  });

  it("accepts the boundary values 0 and 80", () => {
    expect(validateProfileInput({ yearsOfExperience: 0 })).toHaveProperty("data");
    expect(validateProfileInput({ yearsOfExperience: 80 })).toHaveProperty("data");
  });
});
