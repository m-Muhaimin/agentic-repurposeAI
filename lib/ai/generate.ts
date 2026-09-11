import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROMPTS, type OutputFormat } from "./prompts";
import { generateOutputViaFallbackLlm, resolveFallbackEndpoint } from "./openrouter";
import { retryOnOverload } from "./retry";
import { log } from "@/lib/logger";

export type { OutputFormat };

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-3.6-flash";

// What the generate pipeline actually returns — content for the caller plus
// real provider-observed token counts when available.
export interface GenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Gemini's SDK surfaces quota/rate-limit failures as 429s with these markers.
  return /429|quota|rate limit|resource_exhausted/i.test(message);
}

async function generateViaGemini(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<GenerationResult> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt ?? PROMPTS[format]
  });

  const startedAt = Date.now();
  const result = await retryOnOverload(() =>
    model.generateContent(`Transcript:\n\n${transcript.slice(0, 15000)}`)
  );
  const content = result.response.text();

  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const usage = result.response.usageMetadata;
    inputTokens = usage?.promptTokenCount ?? 0;
    outputTokens = usage?.candidatesTokenCount ?? 0;
  } catch {
    // Usage metadata is optional; treat as unknown (0).
  }

  log.info("generate.gemini_ok", { format, duration_ms: Date.now() - startedAt, input_tokens: inputTokens, output_tokens: outputTokens });
  return { content, inputTokens, outputTokens };
}

/**
 * Generates one output format, preferring Gemini and falling back to OpenRouter
 * only when Gemini specifically fails due to quota or rate limits — a real prompt
 * or content error should surface normally rather than silently switching providers
 * and masking the problem.
 *
 * Returns both the content and real provider-observed token counts (inputTokens,
 * outputTokens) — the token counts are real when the provider returns usage
 * metadata, 0 when unknown.
 */
export async function generateOutput(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<GenerationResult> {
  const startedAt = Date.now();
  try {
    return await generateViaGemini(format, transcript, systemPrompt);
  } catch (err) {
    if (!isQuotaOrRateLimitError(err)) {
      log.error("generate.gemini_hard_error", err, { format, duration_ms: Date.now() - startedAt });
      throw err;
    }

    log.warn("generate.gemini_quota", { format, duration_ms: Date.now() - startedAt });

    if (!resolveFallbackEndpoint().apiKey) {
      throw new Error(
        "Gemini hit its quota/rate limit and no fallback LLM key is configured (set LLM_API_KEY or OPENROUTER_API_KEY)."
      );
    }

    try {
      const content = await generateOutputViaFallbackLlm(format, transcript, systemPrompt);
      log.info("generate.openrouter_ok", { format, duration_ms: Date.now() - startedAt });
      // OpenRouter returns content only — token counts not available from the
      // fallback path. Mark as unknown (0) rather than fabricating.
      return { content, inputTokens: 0, outputTokens: 0 };
    } catch (fallbackErr) {
      log.error("generate.openrouter_failed", fallbackErr, {
        format,
        duration_ms: Date.now() - startedAt
      });
      throw fallbackErr;
    }
  }
}