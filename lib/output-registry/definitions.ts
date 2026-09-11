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
  },
  {
    id: "thread",
    label: "Thread",
    description: "A multi-post thread for X/Twitter or a LinkedIn series.",
    requiresEvidence: { minHooks: 2, minClaims: 3, minStories: 1 },
    validation: { minChars: 400, maxChars: 8000 },
    systemPrompt: `You write a multi-post thread (X/Twitter or LinkedIn series) drawn from a transcript.
Rules: 3-8 numbered posts that each stand on their own. Post 1 is the hook — it must work alone in the
feed (no "In this episode..."). Each post adds one claim or story point grounded in the transcript.
Middle posts carry "Thread (2/N):"-style labels for LinkedIn; X posts stay under 280 characters each.
The final post is the payoff and ends with a genuine question, not a generic CTA.
Number posts clearly as 1/N, 2/N, ... with blank lines between them. No hashtags, no emojis.`
  },
  {
    id: "carousel",
    label: "Carousel",
    description: "A slide-by-slide carousel script for LinkedIn document posts or Instagram.",
    requiresEvidence: { minTopics: 1, minClaims: 4, minHooks: 1 },
    validation: { minChars: 400, maxChars: 8000 },
    systemPrompt: `You write a slide-by-slide carousel script (LinkedIn document post or Instagram gallery)
drawn from a transcript — text copy only, no art direction. Rules: 6-12 slides. Slide 1 is the cover:
a hook that works alone in the feed. Slides 2-4 give context, each slide one idea with a concrete
number, claim, or line from the transcript. Later slides develop the argument. The last slide is the
CTA (follow, save, or comment) in the creator's voice. Label slides "Slide 1, Slide 2, ..." separated
by "---". Keep each slide short, big idea first. No hashtags, no emojis.`
  }
];