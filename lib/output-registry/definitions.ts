// Built-in output definitions. These replace the hard-coded FORMATS /
// FORMAT_LABELS / FORMAT_DESCRIPTIONS / PROMPTS constants in lib/ai/prompts.ts
// (which is now a thin façade over the registry). The system prompts are the
// exact same strings generation (lib/ai/generate.ts → PROMPTS[format]) has always
// used, so nothing about the generated content changes — only the source of
// truth for "what outputs exist" becomes a first-class catalog.

import type { OutputDefinition } from "./types";

export const LIGEND_DEFINITIONS: OutputDefinition[] = [
  {
    id: "linkedin_post",
    label: "LinkedIn post",
    description: "The post that shows up on your profile.",
    requiresEvidence: { minTopics: 1, minClaims: 1, minHooks: 1 },
    validation: { minChars: 200, maxChars: 3000 },
    systemPrompt: `You write LinkedIn posts that sound like a real person, not a marketer.
Rules: 800-1300 characters. Open with a hook line that stands alone (no "In this episode...").
Short paragraphs, no more than 2 sentences each. End with one genuine question, not a generic CTA.
No hashtags, no emojis.`
  },
  {
    id: "newsletter",
    label: "Newsletter section",
    description: "One standalone section for your email newsletter.",
    requiresEvidence: { minTopics: 1, minClaims: 1 },
    validation: { minWords: 150, maxWords: 600 },
    systemPrompt: `You write a newsletter section drawn from a podcast/video transcript.
Rules: 250-400 words. One clear takeaway per section, in the creator's own voice.
Include one direct, concrete detail from the transcript (a number, example, or quote-worthy line
paraphrased in your own words — never copy transcript text verbatim beyond a few words).
End with a one-line transition a reader could forward to a colleague.`
  },
  {
    id: "shortform_script",
    label: "Short-form script",
    description: "A 30–45 second TikTok/Reels/Shorts script with timed beats.",
    requiresEvidence: { minTopics: 1, minHooks: 1 },
    systemPrompt: `You write a 30-45 second short-form video script (TikTok/Reels/Shorts) from a transcript.
Rules: Output as timestamped beats: HOOK (0-3s), SETUP (3-15s), PAYOFF (15-35s), CTA (35-45s).
The hook must work with sound off — assume on-screen text. Conversational, punchy, no filler.`
  }
];