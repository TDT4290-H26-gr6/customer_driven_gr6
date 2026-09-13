import { prisma } from "../../db/prisma";

// All Prisma access for courses_* tables lives here.

export function listCourses() {
  return prisma.course.findMany({ orderBy: [{ institution: "asc" }, { name: "asc" }] });
}
