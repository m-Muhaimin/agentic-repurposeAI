import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROMPTS, type OutputFormat } from "./prompts";
import { generateOutputViaOpenRouter } from "./openrouter";
import { retryOnOverload } from "./retry";
import { log } from "@/lib/logger";

export type { OutputFormat };

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-3.6-flash";

function isQuotaOrRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Gemini's SDK surfaces quota/rate-limit failures as 429s with these markers.
  return /429|quota|rate limit|resource_exhausted/i.test(message);
}

async function generateViaGemini(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt ?? PROMPTS[format]
  });

  const startedAt = Date.now();
  const result = await retryOnOverload(() =>
    model.generateContent(`Transcript:\n\n${transcript.slice(0, 15000)}`)
  );
  const content = result.response.text();
  log.info("generate.gemini_ok", { format, duration_ms: Date.now() - startedAt });
  return content;
}

/**
 * Generates one output format, preferring Gemini and falling back to OpenRouter
 * only when Gemini specifically fails due to quota or rate limits — a real prompt
 * or content error should surface normally rather than silently switching providers
 * and masking the problem.
 */
export async function generateOutput(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<string> {
  const startedAt = Date.now();
  try {
    return await generateViaGemini(format, transcript, systemPrompt);
  } catch (err) {
    if (!isQuotaOrRateLimitError(err)) {
      log.error("generate.gemini_hard_error", err, { format, duration_ms: Date.now() - startedAt });
      throw err;
    }

    log.warn("generate.gemini_quota", { format, duration_ms: Date.now() - startedAt });

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "Gemini hit its quota/rate limit and OPENROUTER_API_KEY is not set, so there's no fallback available."
      );
    }

    try {
      const content = await generateOutputViaOpenRouter(format, transcript, systemPrompt);
      log.info("generate.openrouter_ok", { format, duration_ms: Date.now() - startedAt });
      return content;
    } catch (fallbackErr) {
      log.error("generate.openrouter_failed", fallbackErr, {
        format,
        duration_ms: Date.now() - startedAt
      });
      throw fallbackErr;
    }
  }
}