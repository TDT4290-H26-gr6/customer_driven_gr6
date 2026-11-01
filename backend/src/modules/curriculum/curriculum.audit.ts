import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

// Traceability for the curriculum editor: every change is logged (who, when,
// which item, its values before and after) in the same transaction as the
// change itself (security_audit_event). The editor shows each item's latest
// entries; the full log is the admin "change log" CSV.

/** The admin making a change, as the log remembers them. */
export type Actor = { id: string; name: string | null; email: string };

export type EntityType = "question" | "competence" | "section" | "module" | "journey";
export type AuditAction = "created" | "edited" | "deleted" | "retired" | "restored";

type Tx = Prisma.TransactionClient;
type Snapshot = Record<string, unknown>;

/** Dates and the like as plain JSON, as they're stored in the log. */
const asJson = (value: Snapshot): Prisma.InputJsonObject => JSON.parse(JSON.stringify(value));

/**
 * An item's editable values, as the log stores them before and after a change.
 * Null when the item doesn't exist (before a create, after a delete).
 */
export async function snapshot(tx: Tx, type: EntityType, id: string): Promise<Snapshot | null> {
  switch (type) {
    case "question":
      return tx.question.findUnique({
        where: { id },
        select: {
          prompt: true,
          questionType: true,
          sectionModuleId: true,
          competenceId: true,
          authoredContent: true,
          retiredAt: true,
        },
      });
    case "competence":
      return tx.competence.findUnique({ where: { id }, select: { name: true, description: true } });
    case "section":
      return tx.section.findUnique({
        where: { id },
        select: { code: true, name: true, description: true, retiredAt: true },
      });
    case "module": {
      const module = await tx.sectionModule.findUnique({
        where: { id },
        select: {
          name: true,
          description: true,
          sectionId: true,
          level: true,
          mainCompetenceId: true,
          moodleUrl: true,
          retiredAt: true,
          secondaryCompetences: {
            select: { competenceId: true },
            orderBy: { competenceId: "asc" },
          },
        },
      });
      if (!module) return null;
      const { secondaryCompetences, ...rest } = module;
      return { ...rest, secondaryCompetenceIds: secondaryCompetences.map((c) => c.competenceId) };
    }
    case "journey": {
      const journey = await tx.learningJourney.findUnique({
        where: { id },
        select: {
          name: true,
          description: true,
          moodleUrl: true,
          retiredAt: true,
          sections: {
            select: { sectionId: true, coverageLevel: true },
            orderBy: { sectionId: "asc" },
          },
          modules: {
            select: { id: true, order: true, title: true, description: true, sourceId: true },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!journey) return null;
      const { modules, ...rest } = journey;
      return { ...rest, steps: modules };
    }
  }
}

/** What the log shows as the item's name: its name, or a question's prompt (shortened). */
function labelOf(type: EntityType, values: Snapshot | null): string {
  const raw = String((type === "question" ? values?.prompt : values?.name) ?? "");
  return raw.length > 191 ? `${raw.slice(0, 188)}...` : raw;
}

/** Writes one log entry. Call it inside the change's own transaction. */
export async function recordChange(
  tx: Tx,
  actor: Actor,
  change: {
    entityType: EntityType;
    entityId: string;
    action: AuditAction;
    before: Snapshot | null;
    after: Snapshot | null;
  },
) {
  await tx.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      entityType: change.entityType,
      entityId: change.entityId,
      entityLabel: labelOf(change.entityType, change.after ?? change.before),
      action: change.action,
      before: change.before ? asJson(change.before) : undefined,
      after: change.after ? asJson(change.after) : undefined,
    },
  });
}

/** Who did something and when, as the editor shows it. */
export type ChangeMark = { at: Date; by: string };

/** An item's traceability in the editor. `created` is null for items loaded from a dataset. */
export type History = {
  created: ChangeMark | null;
  lastChange: (ChangeMark & { action: AuditAction }) | null;
};

type LogEntry = {
  entityType: string;
  entityId: string;
  action: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string;
};

/**
 * Each item's history from the log, keyed "type:id": who added it (nobody, for
 * items loaded from a dataset) and its latest change. `entries` must be oldest
 * first.
 */
export function historiesFrom(entries: LogEntry[]): Map<string, History> {
  const histories = new Map<string, History>();
  for (const entry of entries) {
    const key = `${entry.entityType}:${entry.entityId}`;
    const history = histories.get(key) ?? { created: null, lastChange: null };
    const mark = { at: entry.createdAt, by: entry.actorName || entry.actorEmail };
    if (entry.action === "created") history.created = mark;
    else history.lastChange = { ...mark, action: entry.action as AuditAction };
    histories.set(key, history);
  }
  return histories;
}

export const NO_HISTORY: History = { created: null, lastChange: null };

/** The columns of the change log CSV, in order. */
export const CHANGE_LOG_COLUMNS = [
  "at",
  "actorName",
  "actorEmail",
  "action",
  "entityType",
  "entityId",
  "entityLabel",
  "before",
  "after",
] as const;

/**
 * The full change log, oldest first, one row per change: who (as they were
 * named when they made it, kept after their account is gone), what, and the
 * item's values before and after as JSON.
 */
export async function listChangeLog() {
  const entries = await prisma.auditEvent.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return entries.map((entry) => ({
    at: entry.createdAt.toISOString(),
    actorName: entry.actorName,
    actorEmail: entry.actorEmail,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    before: entry.before === null ? null : JSON.stringify(entry.before),
    after: entry.after === null ? null : JSON.stringify(entry.after),
  }));
}
