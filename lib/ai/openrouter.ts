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
        // Explicitly disable streaming. Some OpenAI-compatible gateways (e.g. the
        // 9router host) default to SSE delivery when `stream` is omitted, which
        // forces the parser below down its slow SSE path. We only need the final
        // answer, so ask for a single plain JSON response up front.
        stream: false,
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

  const raw = await res.text();
  const data = parseCompletionResponse(raw);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM fallback returned no content.");
  return content as string;
}

/**
 * Parse an OpenAI-compatible chat completion body. Normally a plain JSON object;
 * some gateways stream SSE (`data: {...}` lines) even with `stream: false` — in
 * that case the final non-`[DONE]` chunk carries the content.
 */
function parseCompletionResponse(raw: string): { choices?: Array<{ message?: { content?: string } }> } {
  if (!raw.trim().startsWith("data:")) return JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:") && !l.includes("[DONE]"));
  if (lines.length === 0) throw new Error("LLM fallback streamed an empty response.");
  const last = JSON.parse(lines[lines.length - 1].replace(/^data:\s*/, "")) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  // The last chunk may only carry reasoning; scan back for a chunk with content.
  for (const line of [...lines].reverse()) {
    const chunk = JSON.parse(line.replace(/^data:\s*/, "")) as {
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string }; message?: { content?: string } }>;
    };
    const content = chunk.choices?.[0]?.message?.content ?? chunk.choices?.[0]?.delta?.content;
    if (content) return { choices: [{ message: { content } }] };
  }
  return last;
}