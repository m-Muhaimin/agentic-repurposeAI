---
name: vervai-carousel-writer
description: "Write slide-by-slide carousel content for LinkedIn and Instagram — cover slide that earns the swipe, one point per body slide, closing CTA. A a new Vervai output capability repurposing transcript ideas into swipeable decks. Output is text copy per slide (never visual design)."
metadata:
  version: 1.0.0
---

# VervAI Carousel Writer

Writes swipeable carousel decks from transcript ideas — LinkedIn document posts and
Instagram carousels. Text copy per slide only; visual design is out of scope.

## When to Use

- A transcript holds a framework, list, or before/after story that maps to slides
- User asks for a "carousel," "slides," or "swipe post"
- The planner chooses carousel over thread for a **framework** insight with ≥3 discrete steps/elements

## Evidence Gates (from lib/intelligence)

- **Claims** ≥ 4 (one claim per body slide minimum)
- **Hooks** ≥ 1 (cover headline source)
- **Topics** ≥ 1 (context slide)

A framework carousel needs step-like structure in the transcript. If the source is a
single continuous story, prefer thread format instead.

## Carousel Structure

Four zones:

### Slide 1 — Cover
- Bold headline: one punchy, specific line promising value
- Subtitle: one sentence making the promise concrete
- Max 2–3 lines total. If this slide ran as a standalone post, would it earn attention?

### Slide 2 — Context
- 1–2 short sentences framing the problem/gap/curiosity
- Bridge between hook and value — never skip

### Slides 3–N — Body (one point per slide)
- Bold header (≤8 words) + supporting text (≤30 words)
- End each slide on a micro-cliffhanger or curiosity gap ("…and that's just number 3")
- Patterns: tip slide, step slide ("Step N:"), contrast slide (wrong→right), stat slide (number + insight)

### Final slide — CTA
- One summary sentence + one action (save, share, comment, follow)
- Optional name/handle

## Formats

| Format | Structure |
|---|---|
| Listicle | "[N] tips/mistakes" — one per slide |
| Framework | step-by-step, numbered progression |
| Before/After | contrast slides: wrong approach → right approach |
| Data storytelling | one surprising stat per slide + one-sentence insight |
| Mini case study | Problem → Approach → Result → Lesson |

## Platform Rules

| | LinkedIn | Instagram |
|---|---|---|
| Slide count | 7–12 (sweet spot 9–10) | 8–10 |
| Slide ratio | 1:1 or 4:5 | 4:5 (1080×1350) |
| Text density | can carry more depth | max ~30 words/slide body |
| Caption | hook + teaser; **no link in body** (first comment); 0–3 hashtags | hook in first 125 chars; 3–10 hashtags at end; save/share CTA |
| Primary signal | dwell time, saves | saves, shares |

## Output Shape

```
{ slide: 1, kind: "cover", headline, subtitle }
{ slide: 2, kind: "context", body }
{ slide: 3, kind: "body", header, body }
…
{ slide: N, kind: "cta", summary, cta }
```

## Boundaries

- Text copy only — never produces images, PDFs, or visual design
- Not for single posts (post-writer) or threads (thread-writer)
- Format-shape evaluation still applies: slide structure must be recognizable by `lib/agent/evaluator.ts`