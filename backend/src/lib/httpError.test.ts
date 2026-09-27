import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { HttpError, toHttpError } from "./httpError";

describe("toHttpError", () => {
  it("passes an HttpError through unchanged", () => {
    const err = new HttpError(404, "Unknown question");
    expect(toHttpError(err)).toBe(err);
  });

  it("hides the message of a 5xx HttpError", () => {
    expect(toHttpError(new HttpError(503, "DB password wrong"))).toMatchObject({
      status: 500,
      message: "Internal server error",
    });
  });

  it("maps express.json's unparsable-body error to a 400", () => {
    const err = Object.assign(new SyntaxError("Unexpected token"), {
      type: "entity.parse.failed",
      status: 400,
      expose: true,
    });
    expect(toHttpError(err)).toMatchObject({ status: 400, message: "Malformed JSON body" });
  });

  it("keeps the status and message of other exposed 4xx body errors", () => {
    const err = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
      status: 413,
      expose: true,
    });
    expect(toHttpError(err)).toMatchObject({ status: 413, message: "request entity too large" });
  });

  it("maps Prisma's record-not-found to a 404", () => {
    const err = new Prisma.PrismaClientKnownRequestError("Record to delete does not exist.", {
      code: "P2025",
      clientVersion: "5.22.0",
    });
    expect(toHttpError(err)).toMatchObject({ status: 404, message: "Not found" });
  });

  it("hides anything else behind a generic 500", () => {
    expect(toHttpError(new Error("connection refused at 10.0.0.1"))).toMatchObject({
      status: 500,
      message: "Internal server error",
    });
    expect(toHttpError("a thrown string")).toMatchObject({ status: 500 });
    expect(toHttpError(undefined)).toMatchObject({ status: 500 });
  });

  it("doesn't expose a 5xx even when the error carries its own status", () => {
    const err = Object.assign(new Error("secret detail"), { status: 503, expose: false });
    expect(toHttpError(err)).toMatchObject({ status: 500, message: "Internal server error" });
  });
});
