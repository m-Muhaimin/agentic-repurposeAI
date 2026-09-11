---
name: vervai-content-pattern-analyzer
description: "Find which topics, formats, hooks, tones, times, and platforms consistently perform — emitted as a Do More / Do Less / Experiment report. Extends Vervai's deterministic content-intelligence engine (lib/intelligence) with a performance layer over published Buffer post metrics. Use for 'what's working/what should I change' instead of per-post diagnostics."
metadata:
  version: 1.0.0
---

# VervAI Content Pattern Analyzer

Moves beyond individual post metrics to surface the underlying signals — which
topics, formats, hooks, tones, and timing patterns consistently drive results and
which consistently underperform. Output: a "Do More / Do Less / Experiment" report.

## When to Use

- "What's working?" / "best topics" / "best format" / "best time to post"
- Content audit across the user's published history
- Feeding weekly content-review feedback into the content calendar and the agent strategy engine

## Data Collection

Pattern analysis needs **30+ posts minimum** (reliable). With 15–30 flag low confidence;
below 10 don't run — explain why and ask for more.

Sources in order of preference:
1. Buffer post metrics (v4_buffer_post_metrics + metrics/refresh)
2. `outputs` history (published drafts — includes format + source linkage)
3. Manual CSV/template: `| Post | Date | Format | Topic/Pillar | Hook type | Impressions | Likes | Comments | Reposts | Saves |`

## Pattern Dimensions (analyze all seven)

| Dimension | What to find |
|---|---|
| Topic / pillar | Which pillars beat baseline ER; high-impression-low-engagement (reach without resonance) vs low-impression-high-engagement; pillar gaps |
| Format | Best ER format; format×topic overperformers; saves vs reposts leaders |
| Timing | Best day/time windows; recency bias flag; consistent dead zones |
| Length | ER sweet spot; short-post shareability vs long-post saves |
| Hook type | Which patterns drive engagement; most-used hook; untested patterns |
| Tone | Resonance across educational/personal/storytelling/contrarian/promotional; comment vs save vs repost by tone |
| Platform | Equivalent-content ER across platforms; highest return per post; cross-post adaptation mismatches |

## Output: Do More / Do Less / Experiment

```
## Content Pattern Analysis — [Date Range]
**Posts analyzed:** [N] | **Baseline ER:** [X%] | **Confidence:** [High/Med/Low]

### Do More — [top 3–5 patterns with evidence + why it works]
### Do Less — [bottom 3–5 patterns with evidence + why it underperforms]
### Experiment With — [2–4 untested combinations, each: test + rationale + how to measure]
### Key Takeaway — [1–2 sentences, the single most important shift]
```

Each pattern under 4 sentences. Bold key terms. Active voice.

## Relation to lib/intelligence

`lib/intelligence/` extracts content structure deterministically from sources. This
skill is the **performance feedback loop**: which intelligence signals (topic, hook
type, story presence) actually predicted published engagement. Feed confirmed
patterns back as signal into the recommendation engine (`lib/recommendations/`).

## Boundaries

- Not per-post diagnosis — performance-analyzer skill
- Not follower growth — audience-growth-tracker skill
- Not an action plan — optimization-advisor skill
- Never fabricates — only real published metrics, honestly labeled