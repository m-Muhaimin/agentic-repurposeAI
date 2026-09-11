---
name: vervai-performance-analyzer
description: "Turn post/Buffer metrics into prioritized insights — top and bottom performers, trend analysis, actionable next steps. Complements Vervai's observe endpoint (which tracks run funnel + spend) with real post-performance analytics from Buffer post metrics. Use when reviewing published-content results, not run health."
metadata:
  version: 1.0.0
---

# VervAI Performance Analyzer

Turns raw post data into clear, prioritized insights — what is working, what is not,
and exactly why. Complements VervAI's observability layer:
- `lib/agent/observe.ts` + `/api/agent/observe` = **run health** (funnel, spend, honest
  USD estimates) — this skill does not duplicate that
- This skill = **published-content performance** (engagement rate, impressions, saves,
  trends) using Buffer post metrics (`v4_buffer_post_metrics` via `lib/buffer/mcp.ts`)

## When to Use

- User asks "how are my posts doing," "what's working," or "why isn't this post performing"
- Reviewing Buffer-scheduled/published posts over the last 30 days
- Preparing a weekly content review that feeds back into the content calendar

## Data Collection

Prefill from VervAI data where it exists, else ask the user:

1. Buffer post metrics (from the MCP connector + metrics/refresh endpoint) — impressions, likes, comments, reposts, saves, link clicks, profile visits
2. Published outputs from the `outputs` table (drafts → published for the user's sources)
3. Manual data via the template below when Buffer metrics are unavailable

```
| Post | Date | Impressions | Likes | Comments | Reposts | Saves | Link Clicks | Profile Visits |
```

Require **≥5 posts** with at least impressions + likes + comments. Fewer: explain and ask for more.

## Metrics Framework

### Reach
- Impressions (total appearances), reach (unique accounts), profile visits from post

### Engagement
- Likes (passive), comments (active, higher weight), reposts/shares (distribution),
  saves (intent to return)
- **Engagement rate** = (likes + comments + reposts + saves) / impressions × 100

### Conversion
- Link clicks, DMs, follows from post — only when link present

**Always compare engagement rate, not raw numbers.** 50 likes from 500 impressions
(10% ER) beats 200 likes from 10,000 (2% ER).

## Analysis Outputs (all four, no skipping)

### 1. Top performers (3–5 by ER)
For each: ER + raw numbers, and a diagnosis across **topic, format, hook, timing, CTA**.

### 2. Bottom performers (3–5 by ER)
For each: ER + diagnosis (weak hook? topic misaligned? off-peak time? format mismatch?
too promotional?).

### 3. Trend analysis
- ER trend up/down/flat, impressions trend
- Consistency impact (does frequency dilute quality?)
- Format trends (threads vs singles vs carousels)

### 4. Actionable insights (3–5 prioritized)
Each must reference a specific finding, be actionable this week, and be ranked by impact.

## Benchmarking

Benchmark against **the user's own averages** — never platform-wide vanity metrics.
Calculate baseline ER, impressions/post, comments/post from the window. Only cite
external benchmarks if explicitly asked.

## Reporting Format

```
## Performance Analysis — [Date Range]
**Posts analyzed:** [N] | **Baseline ER:** [X%]
### Top Performers / ### Bottom Performers / ### Trends / ### What to Do Next
```

Keep it scannable; bold key terms; active voice; no >5-column tables.

## Boundaries

- Does not track follower growth — that's the audience-growth-tracker skill
- Does not find cross-post patterns — content-pattern-analyzer skill
- Does not build a prioritized long-term plan — optimization-advisor skill
- Does not write/draft content — content creation skills
- Never fabricates engagement numbers — observe endpoint's honesty rule (no invented metrics) applies here too