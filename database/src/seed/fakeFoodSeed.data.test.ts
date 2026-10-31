import { describe, expect, it } from "vitest";
import seedData from "./data/aios_fake_food_seed.json";

// Structural checks on the authored dataset itself, no DB, no loader. Catches
// a broken id reference or a lopsided section/competence/question count
// before it ever reaches a database. The shape this enforces: 5 sections
// (A–E) x 4 section modules (levels 1–4, one competence each) x 3
// questions = 60.

type Row = Record<string, unknown>;
const tables = seedData as unknown as Record<string, Row[]>;
const table = (name: string) => tables[name] ?? [];

const sections = table("aios.assessment.section");
const competences = table("aios.assessment.competence");
const modules = table("aios.assessment.section_module");
const questions = table("aios.assessment.question");
const sources = table("aios.sources.source");
const secondarySources = table("aios.assessment.competence_secondary_source");
const roles = table("aios.identity.role");
const roleSections = table("aios.identity.role_section");
const roleCompetences = table("aios.identity.role_competence");
const journeys = table("aios.learningJourney.journey");
const journeySections = table("aios.learningJourney.journey_section");
const learningModules = table("aios.learningJourney.learning_module");

const sectionIds = new Set(sections.map((s) => s.id));
const competenceIds = new Set(competences.map((c) => c.id));
const moduleIds = new Set(modules.map((m) => m.id));
const sourceIds = new Set(sources.map((s) => s.id));
const roleIds = new Set(roles.map((r) => r.id));
const journeyIds = new Set(journeys.map((j) => j.id));

function countBy<T extends Row>(rows: T[], key: string): Map<unknown, number> {
  const counts = new Map<unknown, number>();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return counts;
}

describe("fake food seed data: shape", () => {
  it("has 5 sections, 20 competences (4/section), 20 modules, 60 questions", () => {
    expect(sections).toHaveLength(5);
    expect(competences).toHaveLength(20);
    expect(modules).toHaveLength(20);
    expect(questions).toHaveLength(60);
  });

  it("codes the sections A–E, once each", () => {
    expect(sections.map((s) => s.code).sort()).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("gives each section's modules the levels 1–4, once each", () => {
    for (const id of sectionIds) {
      const levels = modules.filter((m) => m.sectionId === id).map((m) => m.level);
      expect([...levels].sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it("gives every module (level) exactly 3 questions", () => {
    const perModule = countBy(questions, "sectionModuleId");
    for (const id of moduleIds) expect(perModule.get(id)).toBe(3);
  });

  it("gives every section exactly 4 modules", () => {
    const perSection = countBy(modules, "sectionId");
    for (const id of sectionIds) expect(perSection.get(id)).toBe(4);
  });

  it("gives every competence exactly 3 questions, all from its own module", () => {
    const perCompetence = countBy(questions, "competenceId");
    for (const id of competenceIds) expect(perCompetence.get(id)).toBe(3);

    const moduleCompetence = new Map(modules.map((m) => [m.id, m.mainCompetenceId]));
    for (const q of questions) {
      expect(q.competenceId).toBe(moduleCompetence.get(q.sectionModuleId));
    }
  });

  it("includes all four question types", () => {
    const types = new Set(questions.map((q) => q.questionType));
    expect(types).toEqual(new Set(["likert", "single_choice", "multi_choice", "true_false"]));
  });
});

describe("fake food seed data: referential integrity", () => {
  it("every module's mainCompetenceId and sectionId resolve to real rows", () => {
    for (const m of modules) {
      expect(competenceIds.has(m.mainCompetenceId as string)).toBe(true);
      expect(sectionIds.has(m.sectionId as string)).toBe(true);
    }
  });

  it("never gives a module a secondary competence that lives in a different section", () => {
    // Each section's axis list (getAttemptSectionScores) is every
    // competence its own modules cover, main or secondary, a secondary
    // competence borrowed from another section would silently give that
    // section a 5th axis, breaking the "4 competences per section" shape.
    const homeSection = new Map<string, string>();
    for (const m of modules) homeSection.set(m.mainCompetenceId as string, m.sectionId as string);

    for (const row of table("aios.assessment.section_module_secondary_competence")) {
      const module = modules.find((m) => m.id === row.moduleId);
      const secondaryHome = homeSection.get(row.competenceId as string);
      if (module && secondaryHome) expect(secondaryHome).toBe(module.sectionId);
    }
  });

  it("no competence is the main competence of modules in two different sections", () => {
    const homeSection = new Map<string, string>();
    for (const m of modules) {
      const compId = m.mainCompetenceId as string;
      const prior = homeSection.get(compId);
      expect(prior === undefined || prior === m.sectionId).toBe(true);
      homeSection.set(compId, m.sectionId as string);
    }
  });

  it("every question's module and competence resolve, and agree on section", () => {
    const homeSection = new Map<string, string>();
    for (const m of modules) homeSection.set(m.mainCompetenceId as string, m.sectionId as string);
    const moduleById = new Map(modules.map((m) => [m.id as string, m]));

    for (const q of questions) {
      expect(moduleIds.has(q.sectionModuleId as string)).toBe(true);
      expect(competenceIds.has(q.competenceId as string)).toBe(true);

      const module = moduleById.get(q.sectionModuleId as string);
      const compHomeSection = homeSection.get(q.competenceId as string);
      if (module && compHomeSection) expect(module.sectionId).toBe(compHomeSection);
    }
  });

  it("every role_section / role_competence grant references a real role and target", () => {
    for (const g of roleSections) {
      expect(roleIds.has(g.roleId as string)).toBe(true);
      expect(sectionIds.has(g.sectionId as string)).toBe(true);
    }
    for (const g of roleCompetences) {
      expect(roleIds.has(g.roleId as string)).toBe(true);
      expect(competenceIds.has(g.competenceId as string)).toBe(true);
    }
  });

  it("every journey_section / learning_module reference resolves", () => {
    for (const js of journeySections) {
      expect(journeyIds.has(js.journeyId as string)).toBe(true);
      expect(sectionIds.has(js.sectionId as string)).toBe(true);
    }
    for (const lm of learningModules) {
      expect(journeyIds.has(lm.journeyId as string)).toBe(true);
      expect(sourceIds.has(lm.sourceId as string)).toBe(true);
    }
  });
});

describe("fake food seed data: sources are Moodle-linked", () => {
  it("gives every source a moodleCourseId, no literal sourceUrl", () => {
    for (const s of sources) {
      expect(s.moodleCourseId).not.toBeUndefined();
      expect(s.moodleCourseId).not.toBeNull();
      expect(s).not.toHaveProperty("sourceUrl");
    }
  });

  it("never reuses a moodleCourseId across sources", () => {
    const ids = sources.map((s) => s.moodleCourseId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every competence a primary source and at least one secondary source", () => {
    const secondaryByCompetence = countBy(secondarySources, "competenceId");
    for (const c of competences) {
      expect(sourceIds.has(c.primarySourceId as string)).toBe(true);
      expect(secondaryByCompetence.get(c.id) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("never points a secondary source at something that doesn't exist", () => {
    for (const row of secondarySources) {
      expect(competenceIds.has(row.competenceId as string)).toBe(true);
      expect(sourceIds.has(row.sourceId as string)).toBe(true);
    }
  });
});
