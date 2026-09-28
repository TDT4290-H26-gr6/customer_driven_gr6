import { describe, expect, it } from "vitest";
import {
  MAX_FEEDBACK_LENGTH,
  toFeedbackDto,
  validateFeedbackInput,
  type FeedbackWithLearner,
} from "./feedback.types";

describe("validateFeedbackInput", () => {
  it("accepts a full body and trims the text", () => {
    const result = validateFeedbackInput({
      message: "  The results page is hard to read  ",
      suggestion: "  Bigger labels on the chart ",
      page: "/results",
    });

    expect(result).toEqual({
      data: {
        message: "The results page is hard to read",
        suggestion: "Bigger labels on the chart",
        page: "/results",
      },
    });
  });

  it("accepts a message alone, with the optional fields as null", () => {
    expect(validateFeedbackInput({ message: "Loading is slow" })).toEqual({
      data: { message: "Loading is slow", suggestion: null, page: null },
    });
  });

  it("turns a blank suggestion into null", () => {
    const result = validateFeedbackInput({ message: "Slow", suggestion: "   " });
    expect(result).toEqual({ data: { message: "Slow", suggestion: null, page: null } });
  });

  it.each([
    ["a missing message", {}],
    ["a blank message", { message: "   " }],
    ["a non-string message", { message: 42 }],
  ])("rejects %s", (_label, body) => {
    expect(validateFeedbackInput(body)).toEqual({
      error: "Please describe what should be improved",
    });
  });

  it("rejects a message over the length limit", () => {
    const result = validateFeedbackInput({ message: "x".repeat(MAX_FEEDBACK_LENGTH + 1) });
    expect(result).toEqual({ error: "message is too long" });
  });

  it("rejects a suggestion over the length limit", () => {
    const result = validateFeedbackInput({
      message: "ok",
      suggestion: "x".repeat(MAX_FEEDBACK_LENGTH + 1),
    });
    expect(result).toEqual({ error: "suggestion is too long" });
  });

  it("rejects a non-string suggestion or page", () => {
    expect(validateFeedbackInput({ message: "ok", suggestion: 1 })).toEqual({
      error: "suggestion must be a string",
    });
    expect(validateFeedbackInput({ message: "ok", page: ["/results"] })).toEqual({
      error: "page must be a string",
    });
  });

  it("rejects a body that isn't an object", () => {
    expect(validateFeedbackInput(null)).toEqual({ error: "Invalid request body" });
    expect(validateFeedbackInput("feedback")).toEqual({ error: "Invalid request body" });
  });
});

describe("toFeedbackDto", () => {
  it("keeps the feedback and only the sender's email and name", () => {
    const createdAt = new Date("2026-09-28T10:00:00Z");
    const feedback: FeedbackWithLearner = {
      id: "fb-1",
      learnerId: "learner-1",
      message: "Slow",
      suggestion: null,
      page: "/results",
      createdAt,
      learner: { email: "tester@ntnu.no", name: "Tess Tester" },
    };

    expect(toFeedbackDto(feedback)).toEqual({
      id: "fb-1",
      message: "Slow",
      suggestion: null,
      page: "/results",
      createdAt,
      learner: { email: "tester@ntnu.no", name: "Tess Tester" },
    });
  });
});
