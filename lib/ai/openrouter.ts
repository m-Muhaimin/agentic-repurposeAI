import { PROMPTS, type OutputFormat } from "./prompts";

// Gemini's quota hits ~20 generateContent calls/day (see AGENTS.md). This is the
// fallback for when Gemini 429s. It targets OpenRouter by default, but the endpoint
// is fully configurable so any OpenAI-compatible `/v1` gateway can serve as the
// quota fallback:
//   - LLM_BASE_URL  (default https://openrouter.ai/api/v1)
//   - LLM_MODEL     (default meta-llama/llama-3.3-70b-instruct; OPENROUTER_MODEL
//                    still honored as the legacy override name)
//   - LLM_API_KEY   (default OPENROUTER_API_KEY)
// Existing deploys that only set OPENROUTER_API_KEY keep working unchanged.
const DEFAULT_FALLBACK_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_FALLBACK_MODEL = "meta-llama/llama-3.3-70b-instruct";

export interface FallbackEndpoint {
  baseUrl: string; // normalized, no trailing slash
  model: string;
  apiKey: string;
}

/** Resolve the fallback LLM endpoint from env (LLM_* overrides, OpenRouter defaults). */
export function resolveFallbackEndpoint(): FallbackEndpoint {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? DEFAULT_FALLBACK_BASE_URL).replace(/\/+$/, ""),
    model: process.env.LLM_MODEL ?? process.env.OPENROUTER_MODEL ?? DEFAULT_FALLBACK_MODEL,
    apiKey: process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY ?? ""
  };
}

// Hard wall-clock cap on a single fallback call. A stuck connection must not
// hang the worker indefinitely (the URL adapters enforce the same guarantee via
// AbortController). Kept close to the Gemini retry budget (MAX_TOTAL_RETRY_MS 90s)
// so a fallback attempt cannot stall a job past its stale window.
const FALLBACK_TIMEOUT_MS = 60_000;

export async function generateOutputViaFallbackLlm(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<string> {
  const { baseUrl, model, apiKey } = resolveFallbackEndpoint();
  if (!apiKey) {
    throw new Error("No fallback LLM API key configured (set LLM_API_KEY or OPENROUTER_API_KEY).");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), FALLBACK_TIMEOUT_MS);
  let res: Response;
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
    // OpenRouter attribution headers — only meaningful for its host; harmless
    // elsewhere but sent universally so third-party hosts see the same shape.
    headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    headers["X-Title"] = "VervAI";

    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt ?? PROMPTS[format] },
          { role: "user", content: `Transcript:\n\n${transcript.slice(0, 15000)}` }
        ]
      })
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`LLM fallback request timed out after ${FALLBACK_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`LLM fallback request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM fallback returned no content.");
  return content as string;
}