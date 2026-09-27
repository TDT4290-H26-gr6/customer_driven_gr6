import { Prisma } from "@prisma/client";

/**
 * An error that already knows its HTTP status. Throw it from a route (or
 * anything a route awaits) and the error handler in server.ts answers with
 * that status and message instead of a generic 500.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Maps whatever a route threw to the response it should produce. Only
 * errors known to be safe to show (4xx) keep their message — anything else
 * is an unexpected failure and becomes an opaque 500.
 */
export function toHttpError(err: unknown): HttpError {
  // A 5xx HttpError falls through to the generic 500 below, so its message
  // (possibly internal detail) is never sent to the client.
  if (err instanceof HttpError && err.status < 500) return err;

  // express.json(): unparsable body, body over the size limit, etc. These
  // carry their own 4xx status and `expose: true`.
  const bodyError = err as { type?: string; status?: number; expose?: boolean; message?: string };
  if (bodyError?.type === "entity.parse.failed") return new HttpError(400, "Malformed JSON body");
  if (
    typeof bodyError?.status === "number" &&
    bodyError.status >= 400 &&
    bodyError.status < 500 &&
    bodyError.expose
  ) {
    return new HttpError(bodyError.status, bodyError.message ?? "Bad request");
  }

  // Prisma's "record to update/delete does not exist" — e.g. the learner a
  // still-valid token points at was deleted.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return new HttpError(404, "Not found");
  }

  return new HttpError(500, "Internal server error");
}
