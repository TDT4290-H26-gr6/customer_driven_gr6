import { describe, expect, it } from "vitest";
import seedData from "./data/aios_wp2_seed.json";
import {
  buildPieContent,
  QUESTION_TYPES,
  type AuthoredContent,
} from "../modules/assessment/assessment.pie";

// Structural checks on the WP2 curriculum dataset itself — no DB, no loader.
// Catches a broken id reference or a malformed item before it reaches a
// database. Unlike the fake dataset it isn't complete yet (modules without
// items, pending item types), so the counts below describe what's delivered.

type Row = Record<string, unknown>;
const tables = seedData as unknown as Record<string, Row[]>;
const table = (name: string) => tables[name] ?? [];

const sections = table("aios.assessment.section");
const competences = table("aios.assessment.competence");
const modules = table("aios.assessment.section_module");
const secondary = table("aios.assessment.section_module_secondary_competence");
const questions = table("aios.assessment.question");
const journeys = table("aios.learningJourney.journey");
const journeySections = table("aios.learningJourney.journey_section");
const pending = table("_pendingItems");

const ids = (rows: Row[]) => new Set(rows.map((r) => r.id));
const sectionIds = ids(sections);
const competenceIds = ids(competences);
const moduleIds = ids(modules);

describe("WP2 seed data: shape", () => {
  it("has sections A–E, 36 competences, 20 modules (A1–E4) and 6 learning journeys", () => {
    expect(sections.map((s) => s.code)).toEqual(["A", "B", "C", "D", "E"]);
    expect(competences).toHaveLength(36);
    expect(modules).toHaveLength(20);
    expect(journeys).toHaveLength(6);
  });

  it("gives each section's modules the levels 1–4, once each, named by their code", () => {
    for (const section of sections) {
      const own = modules.filter((m) => m.sectionId === section.id);
      expect(own.map((m) => m.level).sort()).toEqual([1, 2, 3, 4]);
      for (const m of own)
        expect(String(m.name)).toMatch(new RegExp(`^${section.code}${m.level} — `));
    }
  });

  it("has unique ids and names", () => {
    for (const rows of [sections, competences, modules, questions, journeys]) {
      expect(ids(rows).size).toBe(rows.length);
    }
    expect(new Set(competences.map((c) => c.name)).size).toBe(competences.length);
    expect(new Set(modules.map((m) => m.name)).size).toBe(modules.length);
  });
});

describe("WP2 seed data: references", () => {
  it("every module's main competence and section exist", () => {
    for (const m of modules) {
      expect(competenceIds.has(m.mainCompetenceId)).toBe(true);
      expect(sectionIds.has(m.sectionId)).toBe(true);
    }
  });

  it("every secondary competence link is real and never repeats the main one", () => {
    const mainOf = new Map(modules.map((m) => [m.id, m.mainCompetenceId]));
    for (const link of secondary) {
      expect(moduleIds.has(link.moduleId)).toBe(true);
      expect(competenceIds.has(link.competenceId)).toBe(true);
      expect(link.competenceId).not.toBe(mainOf.get(link.moduleId));
    }
  });

  it("every question belongs to a real module and scores its main competence", () => {
    const mainOf = new Map(modules.map((m) => [m.id, m.mainCompetenceId]));
    for (const q of questions) {
      expect(moduleIds.has(q.sectionModuleId)).toBe(true);
      expect(q.competenceId).toBe(mainOf.get(q.sectionModuleId));
    }
  });

  it("every journey section is real, with a single M/R/S coverage", () => {
    const journeyIds = ids(journeys);
    for (const js of journeySections) {
      expect(journeyIds.has(js.journeyId)).toBe(true);
      expect(sectionIds.has(js.sectionId)).toBe(true);
      expect(["M", "R", "S"]).toContain(js.coverageLevel);
    }
    // Every journey covers all five sections.
    for (const j of journeys) {
      expect(journeySections.filter((js) => js.journeyId === j.id)).toHaveLength(5);
    }
  });
});

describe("WP2 seed data: questions", () => {
  it("only uses question types the app supports, and each builds as a PIE item", () => {
    for (const q of questions) {
      expect(QUESTION_TYPES).toContain(q.questionType);
      expect(() =>
        buildPieContent(String(q.questionType), String(q.prompt), q.content as AuthoredContent),
      ).not.toThrow();
    }
  });

  it("marks one correct answer for single choice and true/false, at least one for multiple choice", () => {
    for (const q of questions) {
      const content = q.content as AuthoredContent;
      if (q.questionType === "likert") continue;
      const optionIds = new Set(content.options?.map((o) => o.id));
      const correct = content.correctOptionIds ?? [];
      for (const id of correct) expect(optionIds.has(id)).toBe(true);
      if (q.questionType === "multi_choice") expect(correct.length).toBeGreaterThan(0);
      else expect(correct).toHaveLength(1);
    }
  });

  it("labels every step of a self-rating", () => {
    for (const q of questions.filter((q) => q.questionType === "likert")) {
      const { scale } = q.content as AuthoredContent;
      expect(scale?.labels).toHaveLength(scale!.max - scale!.min + 1);
    }
  });

  it("keeps items of unsupported types out of the question bank", () => {
    expect(pending.length).toBeGreaterThan(0);
    for (const item of pending) {
      expect(QUESTION_TYPES).not.toContain(item.type);
      expect(
        questions.some((q) =>
          String(q.id).endsWith(String(item.ref).toLowerCase().replace(".", "-")),
        ),
      ).toBe(false);
    }
  });
});

describe("WP2 seed data: Moodle links", () => {
  it("names a distinct (placeholder) Moodle course for every module and journey", () => {
    const courseIds = [...modules, ...journeys].map((row) => row.moodleCourseId);
    expect(courseIds.every((id) => typeof id === "number")).toBe(true);
    expect(new Set(courseIds).size).toBe(courseIds.length);
  });
});
