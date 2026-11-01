import { apiFetch } from "@/shared/api/client";
import { endpoints } from "@/shared/api/endpoints";
import type { Advice } from "./types";

/** The LLM needs a few seconds the first time; later visits read stored advice. */
const ADVICE_TIMEOUT_MS = 60_000;

/**
 * AI advice on the latest completed self-assessment, or null when there's
 * none to give (no completed assessment, or the feature is off, 204).
 * Rejects when the LLM is unavailable (503).
 */
export function getAdvice(): Promise<Advice | null> {
  return apiFetch<Advice | undefined>(endpoints.advice, { timeoutMs: ADVICE_TIMEOUT_MS }).then(
    (advice) => advice ?? null,
  );
}
