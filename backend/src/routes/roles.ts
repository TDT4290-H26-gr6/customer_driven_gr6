import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { ensureDefaultRoles } from "../roles";

export const rolesRouter = Router();

// List selectable roles for the dropdown.
rolesRouter.get("/roles", requireAuth, async (_req: AuthedRequest, res) => {
  if ((await prisma.role.count()) === 0) await ensureDefaultRoles();
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  res.json(roles);
});

// Set the signed-in learner's chosen role.
rolesRouter.put("/auth/me/role", requireAuth, async (req: AuthedRequest, res) => {
  const { roleId } = req.body ?? {};
  if (!roleId) return res.status(400).json({ error: "Missing roleId" });

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return res.status(404).json({ error: "Unknown role" });

  const learner = await prisma.learner.update({
    where: { id: req.learnerId },
    data: { roleId },
    include: { userRole: true },
  });
  res.json({ id: learner.id, email: learner.email, name: learner.name, role: learner.userRole });
});
