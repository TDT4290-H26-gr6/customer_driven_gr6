import { prisma } from "../../db/prisma";

// All Prisma access for sources_* tables lives here.

export function listSources() {
  return prisma.source.findMany({ orderBy: [{ institution: "asc" }, { courseName: "asc" }] });
}
