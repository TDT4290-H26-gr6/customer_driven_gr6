import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { buildPieContent } from "../assessment/assessment.pie";
import {
  createCompetence,
  createQuestion,
  getCurriculum,
  getQuestion,
  isUniqueViolation,
  removeQuestion,
  restoreQuestion,
  updateCompetence,
  updateQuestion,
} from "./curriculum.service";
import { validateCompetenceInput, validateQuestionInput } from "./curriculum.validation";

/**
 * The curriculum editor: admins change the questions and competences learners
 * are assessed on (CD-25). Admin only, like the rest of /admin/*.
 */
export const curriculumRouter = Router();

const admin = [requireAuth, requireAdmin] as const;

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
    const result = await createQuestion(input.data);
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
    const result = await updateQuestion(req.params.id, input.data);
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
    const result = await removeQuestion(req.params.id);
    if (!result) return res.status(404).json({ error: "Unknown question" });
    res.json({ result });
  }),
);

curriculumRouter.post(
  "/admin/curriculum/questions/:id/restore",
  ...admin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    if (!(await restoreQuestion(req.params.id))) {
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
      res.status(201).json(await createCompetence(input.data));
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
      const competence = await updateCompetence(req.params.id, input.data);
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
