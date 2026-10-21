import { describe, expect, it } from "vitest";
import {
  isProfileComplete,
  toLearnerDto,
  validateProfileInput,
  type LearnerWithRole,
} from "./identity.types";

const completeProfile = {
  id: "profile-1",
  learnerId: "learner-1",
  industry: "higher_education",
  academicDegree: "phd",
  background: "PhD candidate in biology",
  yearsOfExperience: 3,
  goals: null,
  updatedAt: new Date("2026-01-01"),
};

function learner(overrides: Partial<LearnerWithRole> = {}): LearnerWithRole {
  return {
    id: "learner-1",
    email: "learner@example.com",
    name: "Ada Lovelace",
    googleSubId: "sub-1",
    orcidId: null,
    roleId: "role-1",
    userRole: {
      id: "role-1",
      name: "Student",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    hasCompletedInitialAssessment: false,
    privacyNoticeAcceptedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    profile: completeProfile,
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
      hasAcceptedPrivacyNotice: false,
      hasCompletedProfile: true,
      // ADMIN_EMAILS is unset under test: everyone is an admin, as in development.
      isAdmin: true,
    });
  });

  it("carries role as null when no persona has been picked yet", () => {
    const dto = toLearnerDto(learner({ userRole: null, roleId: null }));
    expect(dto.role).toBeNull();
  });

  it("reports hasAcceptedPrivacyNotice once the notice has been accepted", () => {
    const accepted = learner({ privacyNoticeAcceptedAt: new Date("2026-02-01") });
    expect(toLearnerDto(accepted).hasAcceptedPrivacyNotice).toBe(true);
  });

  it("reports hasCompletedProfile false without a profile", () => {
    expect(toLearnerDto(learner({ profile: null })).hasCompletedProfile).toBe(false);
  });
});

describe("isProfileComplete", () => {
  it("is true when the name and every profile field are filled in", () => {
    expect(isProfileComplete("Ada", completeProfile)).toBe(true);
  });

  it("accepts 0 years of experience", () => {
    expect(isProfileComplete("Ada", { ...completeProfile, yearsOfExperience: 0 })).toBe(true);
  });

  it("is false when the name is missing or blank", () => {
    expect(isProfileComplete(null, completeProfile)).toBe(false);
    expect(isProfileComplete("   ", completeProfile)).toBe(false);
  });

  it("is false for a missing profile, a missing field, or an unknown dropdown value", () => {
    expect(isProfileComplete("Ada", null)).toBe(false);
    expect(isProfileComplete("Ada", { ...completeProfile, industry: null })).toBe(false);
    expect(isProfileComplete("Ada", { ...completeProfile, academicDegree: "wizard" })).toBe(false);
    expect(isProfileComplete("Ada", { ...completeProfile, background: " " })).toBe(false);
    expect(isProfileComplete("Ada", { ...completeProfile, yearsOfExperience: null })).toBe(false);
  });
});

describe("validateProfileInput", () => {
  const valid = {
    name: "  Ada Lovelace  ",
    industry: "government",
    academicDegree: "master",
    background: "  Data steward at a ministry  ",
    yearsOfExperience: 3,
    goals: "  Learn to share data openly  ",
  };

  it("accepts a fully filled-in body and trims the text", () => {
    expect(validateProfileInput(valid)).toEqual({
      data: {
        name: "Ada Lovelace",
        industry: "government",
        academicDegree: "master",
        background: "Data steward at a ministry",
        yearsOfExperience: 3,
        goals: "Learn to share data openly",
      },
    });
  });

  it("rejects a non-object body", () => {
    expect(validateProfileInput(null)).toEqual({ error: "Invalid request body" });
    expect(validateProfileInput("nope")).toEqual({ error: "Invalid request body" });
  });

  it("requires every field but goals", () => {
    for (const key of Object.keys(valid).filter((k) => k !== "goals")) {
      const body: Record<string, unknown> = { ...valid };
      delete body[key];
      expect(validateProfileInput(body)).toHaveProperty("error");
    }
  });

  it("rejects a blank or over-long name", () => {
    expect(validateProfileInput({ ...valid, name: "   " })).toEqual({ error: "name is required" });
    expect(validateProfileInput({ ...valid, name: "x".repeat(101) })).toEqual({
      error: "name is too long",
    });
  });

  it("rejects dropdown values that aren't one of the options", () => {
    expect(validateProfileInput({ ...valid, industry: "farming" })).toEqual({
      error: "industry must be one of: higher_education, industry_business, government",
    });
    expect(validateProfileInput({ ...valid, academicDegree: "PhD" })).toEqual({
      error: "academicDegree must be one of: bachelor, master, phd, other",
    });
  });

  it("rejects a blank or over-long background", () => {
    expect(validateProfileInput({ ...valid, background: " " })).toEqual({
      error: "background is required",
    });
    expect(validateProfileInput({ ...valid, background: "x".repeat(2001) })).toEqual({
      error: "background is too long",
    });
  });

  it("rejects a non-integer, negative or implausibly large yearsOfExperience", () => {
    expect(validateProfileInput({ ...valid, yearsOfExperience: "3" })).toEqual({
      error: "yearsOfExperience must be a whole number",
    });
    expect(validateProfileInput({ ...valid, yearsOfExperience: 2.5 })).toEqual({
      error: "yearsOfExperience must be a whole number",
    });
    expect(validateProfileInput({ ...valid, yearsOfExperience: -1 })).toEqual({
      error: "yearsOfExperience must be between 0 and 80",
    });
    expect(validateProfileInput({ ...valid, yearsOfExperience: 81 })).toEqual({
      error: "yearsOfExperience must be between 0 and 80",
    });
  });

  it("treats missing, null or blank goals as null", () => {
    for (const goals of [undefined, null, "   "]) {
      const result = validateProfileInput({ ...valid, goals });
      expect("data" in result && result.data.goals).toBeNull();
    }
  });

  it("rejects non-string or over-long goals", () => {
    expect(validateProfileInput({ ...valid, goals: 5 })).toEqual({
      error: "goals must be a string",
    });
    expect(validateProfileInput({ ...valid, goals: "x".repeat(2001) })).toEqual({
      error: "goals is too long",
    });
  });

  it("accepts the boundary values 0 and 80", () => {
    expect(validateProfileInput({ ...valid, yearsOfExperience: 0 })).toHaveProperty("data");
    expect(validateProfileInput({ ...valid, yearsOfExperience: 80 })).toHaveProperty("data");
  });
});
