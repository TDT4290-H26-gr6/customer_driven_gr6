import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Course } from "./types";

/** Third-party courses/resources a learner can take to build a competence area. */
export function getCourses(): Promise<Course[]> {
  return apiFetch<Course[]>(endpoints.courses);
}
