import { HttpError } from "./httpError";

// Small request-input guards. Each returns the value narrowed to the right
// type, or throws a 400 the error handler turns into a response — so a
// malformed body never reaches Prisma and surfaces as a 500.

/** Default cap for an id from a client — ids are uuids, far shorter; 191 is Prisma's MySQL VARCHAR. */
const MAX_ID_LENGTH = 191;

/** A non-empty string of at most `maxLength` characters (default: id-sized). */
export function requireString(value: unknown, field: string, maxLength = MAX_ID_LENGTH): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    throw new HttpError(400, `Missing or invalid ${field}`);
  }
  return value;
}

/** A non-empty array of at most `maxItems` id-sized strings. */
export function requireStringArray(value: unknown, field: string, maxItems = 50): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) {
    throw new HttpError(400, `Missing or invalid ${field}`);
  }
  return value.map((item) => requireString(item, field));
}

export function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, `Missing or invalid ${field}`);
  }
  return value as Record<string, unknown>;
}
