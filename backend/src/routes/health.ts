import { Router } from "express";
import { prisma } from "../prisma";

export const healthRouter = Router();

// Simple end-to-end check: confirms the API is up AND can reach MySQL.
// This is the thing the sprint-1 vertical slice is proving out.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "unreachable" });
  }
});
