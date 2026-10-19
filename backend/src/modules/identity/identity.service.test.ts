import { beforeEach, describe, expect, it, vi } from "vitest";
import * as identity from "./identity.service";
import { prisma } from "../../db/prisma";

vi.mock("../../db/prisma", () => {
  const model = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    prisma: {
      learner: model(),
      learnerProfile: model(),
      role: model(),
      roleSection: model(),
      roleCompetence: model(),
      section: model(),
      competence: model(),
      $transaction: vi.fn(),
    },
  };
});

const mockPrisma = vi.mocked(prisma, true);

/** What every learner read includes, so toLearnerDto has the role and profile. */
const include = { userRole: true, profile: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteLearner", () => {
  it("deletes the learner by id — everything else cascades at the DB level", async () => {
    await identity.deleteLearner("learner-1");

    expect(mockPrisma.learner.delete).toHaveBeenCalledWith({ where: { id: "learner-1" } });
  });
});

describe("findLearnerById", () => {
  it("reads the learner with their role and profile", async () => {
    await identity.findLearnerById("learner-1");
    expect(mockPrisma.learner.findUnique).toHaveBeenCalledWith({
      where: { id: "learner-1" },
      include,
    });
  });
});

describe("upsertLearnerFromGoogle", () => {
  it("creates a new learner with Google's name, keyed on Google's subject id", async () => {
    await identity.upsertLearnerFromGoogle("sub-1", "a@example.com", "Ada");

    const args = mockPrisma.learner.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ googleSubId: "sub-1" });
    expect(args.create).toEqual({ email: "a@example.com", name: "Ada", googleSubId: "sub-1" });
  });

  it("never overwrites the name a returning learner may have edited", async () => {
    await identity.upsertLearnerFromGoogle("sub-1", "new@example.com", "Google Name");

    const args = mockPrisma.learner.upsert.mock.calls[0][0];
    expect(args.update).toEqual({ email: "new@example.com" });
    expect(args.update).not.toHaveProperty("name");
  });
});

describe("roles", () => {
  it("lists roles alphabetically", async () => {
    await identity.listRoles();
    expect(mockPrisma.role.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("finds one role by id", async () => {
    await identity.findRole("role-1");
    expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({ where: { id: "role-1" } });
  });

  it("sets the learner's role", async () => {
    await identity.setLearnerRole("learner-1", "role-1");
    expect(mockPrisma.learner.update).toHaveBeenCalledWith({
      where: { id: "learner-1" },
      data: { roleId: "role-1" },
      include,
    });
  });
});

describe("completeInitialAssessment", () => {
  it("marks the first assessment as done", async () => {
    await identity.completeInitialAssessment("learner-1");
    expect(mockPrisma.learner.update).toHaveBeenCalledWith({
      where: { id: "learner-1" },
      data: { hasCompletedInitialAssessment: true },
      include,
    });
  });
});

describe("profile", () => {
  const input = {
    name: "Ada Lovelace",
    industry: "higher_education" as const,
    academicDegree: "phd" as const,
    background: "Research software",
    yearsOfExperience: 4,
    goals: null,
  };

  it("reads the learner's profile", async () => {
    await identity.getLearnerProfile("learner-1");
    expect(mockPrisma.learnerProfile.findUnique).toHaveBeenCalledWith({
      where: { learnerId: "learner-1" },
    });
  });

  it("saves the name on the learner and the rest on the profile, in one transaction", async () => {
    const saved = { id: "learner-1", name: "Ada Lovelace" };
    mockPrisma.$transaction.mockResolvedValue([{}, saved] as never);

    const result = await identity.saveLearnerProfile("learner-1", input);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const profile = {
      industry: input.industry,
      academicDegree: input.academicDegree,
      background: input.background,
      yearsOfExperience: input.yearsOfExperience,
      goals: input.goals,
    };
    expect(mockPrisma.learnerProfile.upsert).toHaveBeenCalledWith({
      where: { learnerId: "learner-1" },
      update: profile,
      create: { learnerId: "learner-1", ...profile },
    });
    expect(mockPrisma.learner.update).toHaveBeenCalledWith({
      where: { id: "learner-1" },
      data: { name: "Ada Lovelace" },
      include,
    });
    expect(result).toBe(saved);
  });
});

describe("getRoleGrants", () => {
  it("returns the section and competence ids the role may see", async () => {
    mockPrisma.roleSection.findMany.mockResolvedValue([
      { sectionId: "sec-1" },
      { sectionId: "sec-2" },
    ] as never);
    mockPrisma.roleCompetence.findMany.mockResolvedValue([{ competenceId: "c-1" }] as never);

    expect(await identity.getRoleGrants("role-1")).toEqual({
      sectionIds: ["sec-1", "sec-2"],
      competenceIds: ["c-1"],
    });
    expect(mockPrisma.roleSection.findMany).toHaveBeenCalledWith({
      where: { roleId: "role-1" },
      select: { sectionId: true },
    });
  });
});

describe("getVisibilityMatrix", () => {
  it("returns roles, sections, competences and every grant in one object", async () => {
    mockPrisma.role.findMany.mockResolvedValue([{ id: "role-1" }] as never);
    mockPrisma.section.findMany.mockResolvedValue([{ id: "sec-1" }] as never);
    mockPrisma.competence.findMany.mockResolvedValue([{ id: "c-1" }] as never);
    mockPrisma.roleSection.findMany.mockResolvedValue([
      { roleId: "role-1", sectionId: "sec-1" },
    ] as never);
    mockPrisma.roleCompetence.findMany.mockResolvedValue([] as never);

    expect(await identity.getVisibilityMatrix()).toEqual({
      roles: [{ id: "role-1" }],
      sections: [{ id: "sec-1" }],
      competences: [{ id: "c-1" }],
      roleSections: [{ roleId: "role-1", sectionId: "sec-1" }],
      roleCompetences: [],
    });
  });
});

describe("grants", () => {
  it("grants a section once, recording who granted it", async () => {
    await identity.grantSection("role-1", "sec-1", "admin-1");
    expect(mockPrisma.roleSection.upsert).toHaveBeenCalledWith({
      where: { roleId_sectionId: { roleId: "role-1", sectionId: "sec-1" } },
      // Granting again leaves the original grant (and who made it) alone.
      update: {},
      create: { roleId: "role-1", sectionId: "sec-1", grantedByLearnerId: "admin-1" },
    });
  });

  it("revokes a section grant", async () => {
    await identity.revokeSection("role-1", "sec-1");
    expect(mockPrisma.roleSection.deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1", sectionId: "sec-1" },
    });
  });

  it("grants a competence once, recording who granted it", async () => {
    await identity.grantCompetence("role-1", "c-1", "admin-1");
    expect(mockPrisma.roleCompetence.upsert).toHaveBeenCalledWith({
      where: { roleId_competenceId: { roleId: "role-1", competenceId: "c-1" } },
      update: {},
      create: { roleId: "role-1", competenceId: "c-1", grantedByLearnerId: "admin-1" },
    });
  });

  it("revokes a competence grant", async () => {
    await identity.revokeCompetence("role-1", "c-1");
    expect(mockPrisma.roleCompetence.deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1", competenceId: "c-1" },
    });
  });
});
