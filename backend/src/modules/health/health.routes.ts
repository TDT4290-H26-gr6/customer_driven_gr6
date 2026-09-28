import { Router } from "express";
import { prisma } from "../../db/prisma";

export const healthRouter = Router();

// End-to-end check: the API is up AND can reach MySQL.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(500).json({ status: "error", database: "unreachable" });
  }
});
