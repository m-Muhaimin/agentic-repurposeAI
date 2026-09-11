---
name: vervai-hook-writer
description: "Generate high-converting opening lines across nine proven patterns, adapted per platform. Extends Vervai's deterministic intelligence-level hooks (lib/intelligence) into a generative step, and informs the hook requirements checked by the output registry. Use whenever a draft's opening line needs to stop the scroll."
metadata:
  version: 1.0.0
---

# VervAI Hook Writer

Opening lines that stop the scroll, earn the click, and make someone feel they must
keep reading — generated across nine proven patterns and adapted to each platform
and character limit.

## When to Use

- Drafting/regenerating any output whose registry definition requires **hooks** (`requiresEvidence.minHooks ≥ 1`)
- The `linkedin_post`, `shortform_script` defaults and any thread/carousel cover
- A user asks for hook variants for a given topic

## Relationship to lib/intelligence

- `lib/intelligence/` already extracts **hooks** deterministically from transcripts (a
  THIRD-PARTY analysis product of the source). Those are *statements that would make
  good hooks* — the strongest is a candidate for the draft.
- This skill is the **generative** complement: it synthesizes *new* opening lines from
  the transcript while staying grounded (hook must trace to a claim/quote/story in the source).

## Nine Hook Patterns

| # | Pattern | What it does | Example |
|---|---|---|---|
| 1 | Contrarian | Challenges consensus | "Stop posting every day. It's killing your engagement." |
| 2 | Question | Provokes curiosity, addresses the reader | "What if everything you know about content strategy is wrong?" |
| 3 | Story opener | Pulls into a narrative immediately | "Last Tuesday I lost my biggest client. Best thing that ever happened to me." |
| 4 | Statistic / data | Surprises and reframes | "82% of LinkedIn posts get zero engagement." |
| 5 | List preview | Promises structured value | "7 things I wish I knew before I started:" |
| 6 | Bold claim | Demands agreement or argument | "Long-form content is dead. Micro-content wins." |
| 7 | Empathy | Opens with the reader's pain | "Nobody talks about how hard it is to post when nobody's watching." |
| 8 | Before/after | Shows a transformation gap | "I went from 200 to 20,000 followers in 6 months." |
| 9 | Confession | Vulnerability earns trust | "I've been lying about how long my posts actually take." |

## Pattern-to-Platform Fit

| Platform | Best patterns | Notes |
|---|---|---|
| LinkedIn | Story opener, statistic, before/after, empathy | Can use 2–3 lines before the fold |
| Twitter/X | Contrarian, bold claim, question, confession | One punchy line |
| Threads | Empathy, story, confession, before/after | Conversational tone |
| Bluesky | Confession, contrarian, question, bold claim | Anti-corporate wit |
| Short-form video | Curiosity gap, contrarian, list preview, confession | Works sound-off; ≤6 words on screen |

## Process

1. Identify the platform and content type (usually defined by the run/format)
2. Generate 5–7 hook variants across different patterns
3. Adapt each to platform character limits and tone
4. Cross-check grounding: each hook must trace to a transcript claim/quote/story —
   reject hallucinated specificity (fake stats, invented numbers)
5. Mark the top pick with a one-sentence rationale

## Output Shape

```
hooks: [
  { pattern: "contrarian", text: "…", groundedIn: "claim#3" },
  …
],
recommended: 1
```

## Boundaries

- Never fabricates statistics or audience claims — grounding to the transcript is mandatory
- Does not write full posts/threads/carousels — feeds the hook slot those skills and the registry require
- Does not alter the intelligence extractor's own hook scoring