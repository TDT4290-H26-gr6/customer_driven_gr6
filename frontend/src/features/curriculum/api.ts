import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type {
  CompetenceInput,
  Curriculum,
  CurriculumCompetence,
  PreviewContent,
  QuestionDetail,
  QuestionInput,
} from "./types";

export function getCurriculum(): Promise<Curriculum> {
  return apiFetch<Curriculum>(endpoints.admin.curriculum);
}

export function getQuestion(id: string): Promise<QuestionDetail> {
  return apiFetch<QuestionDetail>(endpoints.admin.curriculumQuestion(id));
}

export function createQuestion(input: QuestionInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(endpoints.admin.curriculumQuestions, {
    method: "POST",
    body: input,
  });
}

export function updateQuestion(id: string, input: QuestionInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(endpoints.admin.curriculumQuestion(id), {
    method: "PUT",
    body: input,
  });
}

/** "deleted" for a question nobody answered; "retired" for one with answers. */
export function removeQuestion(id: string): Promise<{ result: "deleted" | "retired" }> {
  return apiFetch<{ result: "deleted" | "retired" }>(endpoints.admin.curriculumQuestion(id), {
    method: "DELETE",
  });
}

export function restoreQuestion(id: string): Promise<void> {
  return apiFetch<void>(endpoints.admin.curriculumRestore(id), { method: "POST" });
}

/** The question built exactly as saving would, without saving it. */
export function previewQuestion(input: QuestionInput): Promise<{ content: PreviewContent }> {
  return apiFetch<{ content: PreviewContent }>(endpoints.admin.curriculumPreview, {
    method: "POST",
    body: input,
  });
}

export function createCompetence(input: CompetenceInput): Promise<CurriculumCompetence> {
  return apiFetch<CurriculumCompetence>(endpoints.admin.curriculumCompetences, {
    method: "POST",
    body: input,
  });
}

export function updateCompetence(
  id: string,
  input: CompetenceInput,
): Promise<CurriculumCompetence> {
  return apiFetch<CurriculumCompetence>(endpoints.admin.curriculumCompetence(id), {
    method: "PUT",
    body: input,
  });
}
