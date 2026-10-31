import { Router, type Response } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { buildPieContent } from "../assessment/assessment.pie";
import { findLearnerById } from "../identity/identity.service";
import { toCsv } from "../stats/stats.csv";
import { CHANGE_LOG_COLUMNS, listChangeLog, type Actor } from "./curriculum.audit";
import { buildCurriculumExport } from "./curriculum.export";
import {
  createCompetence,
  createJourney,
  createModule,
  createQuestion,
  createSection,
  getCurriculum,
  getQuestion,
  isUniqueViolation,
  removeJourney,
  removeModule,
  removeQuestion,
  removeSection,
  restoreJourney,
  restoreModule,
  restoreQuestion,
  restoreSection,
  updateCompetence,
  updateJourney,
  updateModule,
  updateQuestion,
  updateSection,
  type WriteResult,
} from "./curriculum.service";
import {
  validateCompetenceInput,
  validateJourneyInput,
  validateModuleInput,
  validateQuestionInput,
  validateSectionInput,
} from "./curriculum.validation";

/**
 * The curriculum editor: admins change the questions, competences, sections,
 * section modules and learning journeys learners are assessed on and
 * recommended (CD-25). Admin only, like the
 * rest of /admin/*. Every change is logged with the admin who made it (see
 * curriculum.audit.ts).
 */
export const curriculumRouter = Router();

const admin = [requireAuth, requireAdmin] as const;

/** The admin making a change, as the change log records them. */
async function actorOf(req: AuthedRequest): Promise<Actor> {
  const learner = await findLearnerById(req.learnerId!);
  // requireAdmin has just found this account by its email; it's only gone if deleted since.
  if (!learner?.email) throw new Error("The admin's account no longer exists");
  return { id: learner.id, name: learner.name, email: learner.email };
}

// The whole curriculum as a dataset file db-init can load (see curriculum.export.ts).
curriculumRouter.get(
  "/admin/curriculum/export.json",
  ...admin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    res.header("Content-Disposition", `attachment; filename="aios-curriculum-${date}.json"`);
    res.type("application/json").send(JSON.stringify(await buildCurriculumExport(now), null, 2));
  }),
);

// Every change made in the curriculum editor: who, when, what, before and after.
curriculumRouter.get(
  "/admin/curriculum/changelog.csv",
  ...admin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    const csv = toCsv([...CHANGE_LOG_COLUMNS], await listChangeLog());
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.header("Content-Disposition", 'attachment; filename="aios-curriculum-changelog.csv"');
    res.send(csv);
  }),
);

curriculumRouter.get(
  "/admin/curriculum",
  ...admin,
  asyncHandler<AuthedRequest>(async (_req, res) => {
    res.json(await getCurriculum());
  }),
);

// Builds the question exactly as saving would, without saving it, so the
// editor can show it as learners will see it.
curriculumRouter.post(
  "/admin/curriculum/questions/preview",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = validateQuestionInput(req.body);
    if ("error" in result) return res.status(400).json({ error: result.error });
    const { questionType, prompt, content } = result.data;
    res.json({ content: buildPieContent(questionType, prompt, content) });
  }),
);

curriculumRouter.get(
  "/admin/curriculum/questions/:id",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const question = await getQuestion(req.params.id);
    if (!question) return res.status(404).json({ error: "Unknown question" });
    res.json(question);
  }),
);

curriculumRouter.post(
  "/admin/curriculum/questions",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = validateQuestionInput(req.body);
    if ("error" in input) return res.status(400).json({ error: input.error });
    const result = await createQuestion(await actorOf(req), input.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ id: result.id });
  }),
);

curriculumRouter.put(
  "/admin/curriculum/questions/:id",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = validateQuestionInput(req.body);
    if ("error" in input) return res.status(400).json({ error: input.error });
    const result = await updateQuestion(await actorOf(req), req.params.id, input.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ id: result.id });
  }),
);

// 200 with { result: "deleted" } for a question nobody answered, or
// { result: "retired" } for one with answers (see removeQuestion).
curriculumRouter.delete(
  "/admin/curriculum/questions/:id",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = await removeQuestion(await actorOf(req), req.params.id);
    if (!result) return res.status(404).json({ error: "Unknown question" });
    res.json({ result });
  }),
);

curriculumRouter.post(
  "/admin/curriculum/questions/:id/restore",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    if (!(await restoreQuestion(await actorOf(req), req.params.id))) {
      return res.status(404).json({ error: "Unknown question" });
    }
    res.status(204).end();
  }),
);

curriculumRouter.post(
  "/admin/curriculum/competences",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = validateCompetenceInput(req.body);
    if ("error" in input) return res.status(400).json({ error: input.error });
    try {
      res.status(201).json(await createCompetence(await actorOf(req), input.data));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: "A competence with that name already exists" });
      }
      throw err;
    }
  }),
);

curriculumRouter.put(
  "/admin/curriculum/competences/:id",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const input = validateCompetenceInput(req.body);
    if ("error" in input) return res.status(400).json({ error: input.error });
    try {
      const competence = await updateCompetence(await actorOf(req), req.params.id, input.data);
      if (!competence) return res.status(404).json({ error: "Unknown competence" });
      res.json(competence);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: "A competence with that name already exists" });
      }
      throw err;
    }
  }),
);

/**
 * Create / edit / remove / restore routes for sections and modules, which
 * work alike: a taken name (or section code) is a 409, and removing deletes
 * an empty one or retires one that's in use (see the service).
 */
function structureRoutes<Input>(
  path: string,
  label: string,
  validate: (body: unknown) => { data: Input } | { error: string },
  service: {
    create: (actor: Actor, input: Input) => Promise<WriteResult>;
    update: (actor: Actor, id: string, input: Input) => Promise<WriteResult>;
    remove: (actor: Actor, id: string) => Promise<"deleted" | "retired" | null>;
    restore: (actor: Actor, id: string) => Promise<boolean>;
  },
) {
  const taken = `A ${label} with that name${label === "section" ? " or code" : ""} already exists`;

  async function save(run: () => Promise<WriteResult>, res: Response, created = false) {
    try {
      const result = await run();
      if (!result.ok) return res.status(result.status).json({ error: result.error });
      res.status(created ? 201 : 200).json({ id: result.id });
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: taken });
      throw err;
    }
  }

  curriculumRouter.post(
    path,
    ...admin,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const input = validate(req.body);
      if ("error" in input) return res.status(400).json({ error: input.error });
      const actor = await actorOf(req);
      await save(() => service.create(actor, input.data), res, true);
    }),
  );

  curriculumRouter.put(
    `${path}/:id`,
    ...admin,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const input = validate(req.body);
      if ("error" in input) return res.status(400).json({ error: input.error });
      const actor = await actorOf(req);
      await save(() => service.update(actor, req.params.id, input.data), res);
    }),
  );

  curriculumRouter.delete(
    `${path}/:id`,
    ...admin,
    asyncHandler<AuthedRequest>(async (req, res) => {
      const result = await service.remove(await actorOf(req), req.params.id);
      if (!result) return res.status(404).json({ error: `Unknown ${label}` });
      res.json({ result });
    }),
  );

  curriculumRouter.post(
    `${path}/:id/restore`,
    ...admin,
    asyncHandler<AuthedRequest>(async (req, res) => {
      if (!(await service.restore(await actorOf(req), req.params.id))) {
        return res.status(404).json({ error: `Unknown ${label}` });
      }
      res.status(204).end();
    }),
  );
}

structureRoutes("/admin/curriculum/sections", "section", validateSectionInput, {
  create: createSection,
  update: updateSection,
  remove: removeSection,
  restore: restoreSection,
});

structureRoutes("/admin/curriculum/modules", "module", validateModuleInput, {
  create: createModule,
  update: updateModule,
  remove: removeModule,
  restore: restoreModule,
});

structureRoutes("/admin/curriculum/journeys", "journey", validateJourneyInput, {
  create: createJourney,
  update: updateJourney,
  remove: removeJourney,
  restore: restoreJourney,
});
