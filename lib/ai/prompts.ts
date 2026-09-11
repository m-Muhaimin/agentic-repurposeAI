// Thin façade over the Phase-5 Output Registry. Everything the legacy
// generation/billing/agent code imports (OutputFormat, FORMATS, FORMAT_LABELS,
// FORMAT_DESCRIPTIONS, PROMPTS, PROMPT_KEYS, BRAND_VOICE_KEY, buildSystemPrompt)
// still exists here with the same shapes — but the source of truth for "what
// outputs exist" is now lib/output-registry, not these maps. New outputs are
// added in the registry and automatically appear everywhere.

import { outputRegistry } from "@/lib/output-registry";

export type OutputFormat = "linkedin_post" | "newsletter" | "shortform_script" | "thread" | "carousel";

export const FORMATS: OutputFormat[] =
  outputRegistry.formats().filter((f): f is OutputFormat =>
    ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"].includes(f)
  );

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter section",
  shortform_script: "Short-form script",
  thread: "Thread",
  carousel: "Carousel"
};

export const FORMAT_DESCRIPTIONS: Record<OutputFormat, string> = {
  linkedin_post: "The post that shows up on your profile.",
  newsletter: "One standalone section for your email newsletter.",
  shortform_script: "A 30–45 second TikTok/Reels/Shorts script with timed beats.",
  thread: "A multi-post thread for X/Twitter or a LinkedIn series.",
  carousel: "A slide-by-slide carousel script for LinkedIn document posts or Instagram."
};

// Custom prompts can override each format's default below, plus a global
// "brand voice" note that is layered on top of whatever prompt runs.
export const BRAND_VOICE_KEY = "brand_voice";

export const PROMPT_KEYS = [...FORMATS, BRAND_VOICE_KEY] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export const PROMPTS: Record<OutputFormat, string> = {
  linkedin_post: outputRegistry.get("linkedin_post")?.systemPrompt ?? "",
  newsletter: outputRegistry.get("newsletter")?.systemPrompt ?? "",
  shortform_script: outputRegistry.get("shortform_script")?.systemPrompt ?? "",
  thread: outputRegistry.get("thread")?.systemPrompt ?? "",
  carousel: outputRegistry.get("carousel")?.systemPrompt ?? ""
};

/**
 * Resolves the system prompt for a format: the per-format override if one is
 * set, otherwise the built-in default, with the global brand-voice note layered
 * on top of whichever base prompt wins.
 */
export function buildSystemPrompt(
  format: OutputFormat,
  prompts: Partial<Record<PromptKey, string | null | undefined>>
): string {
  const base = (prompts[format] ?? "").trim() || PROMPTS[format];
  const brand = (prompts[BRAND_VOICE_KEY] ?? "").trim();
  return brand ? `${base}\n\nBrand voice — apply these guidelines to the whole draft:\n${brand}` : base;
}