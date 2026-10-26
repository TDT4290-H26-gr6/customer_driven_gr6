import { Router } from "express";
import { requireAuth, AuthedRequest } from "../../middleware/requireAuth";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../lib/asyncHandler";
import { HttpError } from "../../lib/httpError";
import { requireString } from "../../lib/validate";
import { getDropoff, type DropoffType } from "./dropoff.service";

/**
 * Admin-only question drop-off (CD-125): aggregates over abandoned and
 * completed self-assessments, never an identified learner. See
 * dropoff.service.ts for the definitions.
 */
export const dropoffRouter = Router();

const DEFAULT_INACTIVE_DAYS = 7;
const MAX_INACTIVE_DAYS = 3650;

function optionalQueryString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  return requireString(value, field);
}

function optionalDate(value: unknown, field: string): Date | undefined {
  const raw = optionalQueryString(value, field);
  if (raw === undefined) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `Missing or invalid ${field}`);
  return date;
}

function parseType(value: unknown): DropoffType {
  if (value === undefined || value === "") return "initial";
  if (value === "initial" || value === "targeted_reevaluation") return value;
  throw new HttpError(400, "Missing or invalid type");
}

function parseInactiveDays(value: unknown): number {
  if (value === undefined || value === "") return DEFAULT_INACTIVE_DAYS;
  const days = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > MAX_INACTIVE_DAYS) {
    throw new HttpError(400, "Missing or invalid inactiveDays");
  }
  return days;
}

dropoffRouter.get(
  "/admin/sat/dropoff",
  requireAuth,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const result = await getDropoff({
      type: parseType(req.query.type),
      sectionId: optionalQueryString(req.query.sectionId, "sectionId"),
      from: optionalDate(req.query.from, "from"),
      to: optionalDate(req.query.to, "to"),
      inactiveDays: parseInactiveDays(req.query.inactiveDays),
    });
    res.json(result);
  }),
);
