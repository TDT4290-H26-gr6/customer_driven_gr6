import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Question } from "./types";

/** All questions in the bank, with their competence area and PIE content. */
export function getQuestions(): Promise<Question[]> {
  return apiFetch<Question[]>(endpoints.questions);
}
