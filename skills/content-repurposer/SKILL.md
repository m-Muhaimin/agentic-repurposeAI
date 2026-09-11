---
name: vervai-content-repurposer
description: "Turn one long-form piece of content into multiple platform-native derivatives — LinkedIn posts, Twitter/X threads, carousels, Threads posts, Newsletter sections, Short-form scripts, and captions with a different register per platform. Use when generating new output formats from an existing transcript or when the user wants to maximize a single source. Vervai-native: reads from lib/output-registry (authoritative format definitions) and the agent tool registry — never forks its own format definitions."
metadata:
  version: 1.0.0
---

# VervAI Content Repurposer

Extracts maximum value from every piece of content — turning one transcript into a
week of platform-native posts without sounding like copy-paste spam. This skill is
the decision layer on top of VervAI's existing ingestion + generation pipeline.

## When to Use

- User asks to repurpose content, "turn this into," or "adapt this for"
- User wants to **extract many derivatives** from a single transcript beyond VervAI's default 3 (linkedin_post, newsletter, shortform_script)
- User wants **cross-platform adaptation** — the same source, different register per platform

## Vervai Integration Points

- **Source material**: read the canonical transcript from the `transcripts` table (keyed on `source_id`)
- **Format definitions**: the AUTHORITATIVE registry is `lib/output-registry/`. Add new output types there, never here. `lib/ai/prompts.ts` is only the thin façade over the registry.
- **Generation**: use the existing `generation` agent tool (writes drafts to `outputs`) — do not invent a second generation path.
- **Voice**: brand voice lives in `user_prompts` (per-format overrides + global `brand_voice`) and in `v4_agent_preferences` (tone/forbidden phrases/examples from `edit_signals`). Never guess voice — read it.
- **Distribution**: Buffer is the deployment target (`lib/buffer/mcp.ts`). Publishing stays manual-approval-only — the skill recommends, the human sends.
- **Deterministic evaluation**: `lib/agent/evaluator.ts` scores drafts (length 0.4 / format-shape 0.3 / grounding 0.3). Every derivative produced by this skill must be evaluable by that rubric, no LLM judge.

## Repurposing Matrix

Highest-value derivatives per source. Check `lib/output-registry/registry.ts` for which
formats a given source already satisfies (`requiresEvidence` gates).

| Source | Best Derivatives (beyond defaults) | Vervai status |
|---|---|---|
| Podcast / video transcript | Twitter/X thread of key moments, LinkedIn carousel (framework), quote posts, Threads casual takes | Fits everything the output registry already has evidence for (topics/claims/quotes/hooks) |
| Long-form article | X thread (takeaways), LinkedIn carousel (framework), Threads one-liners, standalone posts | Same evidence set |
| Webinar / live | YouTube replay notes, carousel of key slides, X thread | Needs `minQuotes`/`minHooks` evidence — check registry gate |
| Existing social post | Adapt to other platforms (lengthen for LinkedIn, shorten for X), turn into a hook | Evidence from the transcript already covers this |

**Rule**: a derivative needs the registry's `requiresEvidence` satisfied by the source's
intelligence output. If the evidence gate fails, the draft is not grounded and the
evaluator will score it low on grounding (0.3 weight) — do not ship it.

## Process

### Step 1 — Extract key insights (deterministic)

Read the transcript and pull **3–7 standalone insights** via VervAI's existing content
intelligence engine — `lib/intelligence/` produces topics, themes, claims, quotes,
stories, questions, hooks, entities, insights, opportunities **without any LLM in the
analyse path**. Reuse those outputs. Do not re-run an LLM to extract insights.

### Step 2 — Rank by standalone value

Order insights by whether each could carry a post on its own. The top insight is the
anchor derivative; the rest become supporting posts.

### Step 3 — Match insights to formats

| Insight type | Best format |
|---|---|
| Step-by-step process | Carousel or thread |
| Single counterintuitive claim | Standalone post or thread opener |
| Story with a lesson | Thread (narrative arc) or LinkedIn long-form |
| Data point | Standalone post with context |
| Framework / model | Carousel (one slide per element) |
| Quote or memorable line | Standalone quote post |

### Step 4 — Draft each derivative (platform-native)

The voice stays the same; the **register shifts** per platform. The generation tool's
system prompt already enforces format rules; layer the register table below on top.

| Platform | Register |
|---|---|
| LinkedIn | Thoughtful, professional, story-forward |
| Twitter/X | Sharp, opinionated, direct |
| Threads | Casual, human, low-key |
| Short-form video | Native, low-polish, conversational |

### Step 5 — Apply anti-patterns

- **No copy-paste across platforms** — identical text on X and LinkedIn reads as spam
- **No "I wrote a blog post about…"** — lead with the insight, not the referral
- **No posting all derivatives the same day** — spread via the Buffer schedule / content calendar
- **No ignoring platform character limits** — LinkedIn breathes; X cannot

## Leverage Ranking

Best reach-per-effort among derivatives (default):

1. **Short-form video script** (highest ceiling — TikTok/Reels/Shorts amplification)
2. **Twitter/X thread** (high reach if hook lands)
3. **LinkedIn post** (durable reach)
4. **LinkedIn carousel** (saves drive discovery)
5. **Newsletter section** (evergreen, ownable asset)
6. **Threads post** (low effort, casual reach, good for testing angles)

## Boundaries

- Does not define VervAI's output formats — the registry (`lib/output-registry/`) is authoritative
- Does not change the agent runtime, permissions, or budget policy
- Does not publish autonomously — Buffer sends are human-initiated only
- Does not re-analyse transcripts with an LLM — uses `lib/intelligence/` deterministically