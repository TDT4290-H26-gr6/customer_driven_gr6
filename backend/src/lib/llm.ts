// The only place that calls the LLM. NTNU's IDUN service speaks the OpenAI
// chat-completions API (https://llm.hpc.ntnu.no/v1), so this is plain fetch —
// no SDK. Requests stay inside NTNU and aren't stored by the service.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmSettings = { baseUrl: string; apiKey: string; model: string };

/** Long enough for a slow answer, short enough that the results page isn't left hanging. */
const DEFAULT_TIMEOUT_MS = 45_000;

/** Some models wrap JSON in a ```json fence even when asked not to. */
export function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : text.trim();
}

/**
 * Sends a chat and returns the reply parsed as JSON. Throws on a network
 * error, a timeout, a non-2xx status, or a reply that isn't JSON — the
 * caller decides what a failure means for the user.
 */
export async function chatJson(
  settings: LlmSettings,
  messages: ChatMessage[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      // Low temperature: advice should be steady, not creative.
      temperature: 0.2,
      // Room for the advice JSON (summary, ranked journeys, steps) plus the
      // reasoning tokens models like gpt-oss spend before answering — at
      // 1500 the reply could be cut off mid-JSON.
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`LLM request failed with ${res.status}: ${detail}`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM reply had no message content");

  return JSON.parse(stripCodeFence(content));
}
