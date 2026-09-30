import { afterEach, describe, expect, it, vi } from "vitest";
import { chatJson, stripCodeFence } from "./llm";

const settings = { baseUrl: "https://llm.test/v1", apiKey: "sk-test", model: "test-model" };
const messages = [{ role: "user" as const, content: "hi" }];

function replyWith(content: unknown, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stripCodeFence", () => {
  it("unwraps a ```json fence", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves plain JSON alone", () => {
    expect(stripCodeFence(' {"a":1} ')).toBe('{"a":1}');
  });
});

describe("chatJson", () => {
  it("posts an OpenAI-style chat request and parses the JSON reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(replyWith('{"summary":"ok"}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(chatJson(settings, messages)).resolves.toEqual({ summary: "ok" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body)).toMatchObject({
      model: "test-model",
      messages,
      response_format: { type: "json_object" },
    });
  });

  it("parses a reply wrapped in a code fence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(replyWith('```json\n{"a":1}\n```')));
    await expect(chatJson(settings, messages)).resolves.toEqual({ a: 1 });
  });

  it("throws on an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    await expect(chatJson(settings, messages)).rejects.toThrow(/429/);
  });

  it("throws when the reply isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(replyWith("Sure! Here is some advice.")));
    await expect(chatJson(settings, messages)).rejects.toThrow();
  });

  it("throws when the reply has no content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(replyWith(null)));
    await expect(chatJson(settings, messages)).rejects.toThrow(/no message content/);
  });
});
