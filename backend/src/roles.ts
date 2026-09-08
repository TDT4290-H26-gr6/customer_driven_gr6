import { prisma } from "./prisma";

// Default selectable personas. Idempotent: safe to run on every boot.
export const DEFAULT_ROLES = [
  "Student",
  "Librarian",
  "Researcher",
  "Professor",
  "Research Data Steward",
  "Administrator",
  "CEO",
  "Other",
];

export async function ensureDefaultRoles() {
  await prisma.role.createMany({
    data: DEFAULT_ROLES.map((name) => ({ name })),
    skipDuplicates: true,
  });
}
