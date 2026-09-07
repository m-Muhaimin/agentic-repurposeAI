export type OutputFormat = "linkedin_post" | "newsletter" | "shortform_script";

export const FORMATS: OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter section",
  shortform_script: "Short-form script"
};

export const FORMAT_DESCRIPTIONS: Record<OutputFormat, string> = {
  linkedin_post: "The post that shows up on your profile.",
  newsletter: "One standalone section for your email newsletter.",
  shortform_script: "A 30–45 second TikTok/Reels/Shorts script with timed beats."
};

// Custom prompts can override each format's default below, plus a global
// "brand voice" note that is layered on top of whatever prompt runs.
export const BRAND_VOICE_KEY = "brand_voice";

export const PROMPT_KEYS = [...FORMATS, BRAND_VOICE_KEY] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

export const PROMPTS: Record<OutputFormat, string> = {
  linkedin_post: `You write LinkedIn posts that sound like a real person, not a marketer.
Rules: 800-1300 characters. Open with a hook line that stands alone (no "In this episode...").
Short paragraphs, no more than 2 sentences each. End with one genuine question, not a generic CTA.
No hashtags, no emojis.`,
  newsletter: `You write a newsletter section drawn from a podcast/video transcript.
Rules: 250-400 words. One clear takeaway per section, in the creator's own voice.
Include one direct, concrete detail from the transcript (a number, example, or quote-worthy line
paraphrased in your own words — never copy transcript text verbatim beyond a few words).
End with a one-line transition a reader could forward to a colleague.`,
  shortform_script: `You write a 30-45 second short-form video script (TikTok/Reels/Shorts) from a transcript.
Rules: Output as timestamped beats: HOOK (0-3s), SETUP (3-15s), PAYOFF (15-35s), CTA (35-45s).
The hook must work with sound off — assume on-screen text. Conversational, punchy, no filler.`
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