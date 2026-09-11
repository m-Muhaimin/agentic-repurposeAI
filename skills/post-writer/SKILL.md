---
name: vervai-post-writer
description: "Write single standalone platform-native posts from a Vervai transcript — LinkedIn, Twitter/X, Threads, Bluesky. Applies per-platform structure rules (hook/body/CTA), character limits, formatting, and the user's brand voice on top of the output-registry prompt. Use for single-post outputs, not threads or carousels."
metadata:
  version: 1.0.0
---

# VervAI Post Writer

Writes single standalone posts that stop the scroll, match the creator's authentic
voice, and drive engagement — running entirely through VervAI's existing output
registry and generation tooling.

## When to Use

- Generating the `linkedin_post` output (registry id) from a source
- A user asks for a single standalone post (not a thread or carousel)
- Refining/regenerating a draft in the `/repurpose/[id]` editor

## Grounding

- **Transcript**: the canonical transcript from the `transcripts` table (keyed on `source_id`)
- **Tangible evidence**: `lib/intelligence/` evidence segments (topics, claims, hooks, quotes). The registry's `requiresEvidence: { minTopics: 1, minClaims: 1, minHooks: 1 }` must pass or the draft is ungrounded.
- **Brand voice**: resolved via `buildSystemPrompt(format, prompts)` in `lib/ai/prompts.ts` — per-format override or registry default + global brand_voice layered on top.

## Post Anatomy (universal)

1. **Hook** (1–2 lines) — must earn the "see more" click; no throat-clearing, no "In this episode…"
2. **Body** — line break every 1–2 sentences; white space is readability
3. **CTA** — one genuine question or directive, specific to content type

| Content type | CTA |
|---|---|
| Educational | "What would you add?" |
| Storytelling | "Has this happened to you?" |
| Promotional | "Link in comments / DM me [word]" |
| Engagement | open question inviting a reply |
| Personal | "Anyone else?" |

## Platform Structure

### LinkedIn (registry `linkedin_post`)
- **Spec**: 800–1300 chars (registry validation: 200–3000). First-person, specific, professional but not corporate.
- **Rules**: short paragraphs (≤2 sentences), no links in body (first comment), end with a genuine question, no hashtags/emojis by default.
- **Best patterns**: personal story + lesson, industry take, how-to breakdown.

### Twitter/X
- Hook → core message → CTA in one tight unit; under 280 chars.
- 0–2 hashtags. No fluff. Contrarian/question hooks land best.

### Threads
- Conversational, raw, human. 500 chars. Empathy/story openers land best.

### Bluesky
- 300 chars, authentic, anti-corporate. Wit and genuine perspective outperform "growth hacks."

## Voice Matching

Read the user's brand voice and example posts (`v4_agent_preferences`, `edit_signals`)
to match vocabulary, sentence rhythm, punctuation habits, and emotional register.

## Pre-Publish Checklist

- [ ] Hook stands alone and stops the scroll
- [ ] Voice is consistent — sounds like the creator, not a generic expert
- [ ] CTA is clear and content-type specific
- [ ] Length within registry validation
- [ ] No links in LinkedIn/Instagram body
- [ ] Hashtag count per platform (0 LinkedIn default, 0–2 X, 0–1 Threads, 0 Bluesky)
- [ ] White space readable — empty line after every 1–2 lines

## Boundaries

- Single posts only — see the thread-writer and carousel-writer skills for multi-part formats
- Does not publish — Buffer sends stay human-initiated via the publish queue
- Does not change registry definitions or evaluator weights