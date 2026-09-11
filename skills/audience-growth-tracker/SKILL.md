---
name: vervai-audience-growth-tracker
description: "Track follower growth, diagnose what drives new followers, and connect content decisions to audience outcomes — net growth per period, growth rate, spike correlation with content, and stall diagnosis. Use when the user asks about followers, growth, or 'why am I not growing.'"
metadata:
  version: 1.0.0
---

# VervAI Audience Growth Tracker

Turns follower data into clear, actionable insight — what drives new followers, what
causes stalls or drops, and what to do next. Connects content decisions to audience
outcomes. Every analysis ends with specific recommendations.

## When to Use

- "Follower growth," "followers," "why am I not growing," "what's working for growth"
- Follower milestone tracking against the user's stated goals

## Data Collection

Prefill from connected platforms where available (Buffer-linked accounts), else ask:

> Follower counts at weekly intervals for at least 4 weeks + the list of posts from
> the same period. Minimum for useful analysis: 2+ data points.

```
| Date | Follower Count | Notable Content That Day |
```

## Growth Analysis (four dimensions)

### 1. Net growth per period
- Net = ending − starting; distinguish gross follows vs unfollows when available
- Best/worst 3 periods; flag unevenness ("60% of new followers came in one 5-day window")

### 2. Growth rate (%)
- Period rate = (new / starting) × 100; trend accelerating/decelerating/flat
- Project forward if the rate holds; frame against the user's milestone goal from context

### 3. Growth spikes ↔ content
For each spike (≥2× average daily growth): what was posted, why it likely drove follows
(virality / authority signal / social proof / discovery), and how long the spike lasted.

### 4. Growth stalls — diagnosis
- Was posting frequency lower? Did content type shift to low-discovery formats?
- Unfollow spike → content disappointed existing followers
- Platform algorithm change? Broad-based (many creators) vs account-specific?

## Content–Growth Correlation

- **Which content drives follows?** Group by format/topic; compute avg new followers per post.
  Educational threads & strong takes typically high-follow; entertainment for current
  followers = high engagement but few follows (both have value — different goals).
- **Spike-driven vs compound growth** — bursts tied to breakout posts vs steady weekly
  gains from consistent output. Identify the user's pattern and match it to goals/capacity.

## Growth Recommendations

Generate 3–5 specific, prioritized actions, each finding-backed and rankable:

1. "Double down on educational threads — your 3 highest-follower posts were all threads"
2. "Add a follow CTA to breakout posts — your viral post drove 200 reposts but 30 follows"
3. "Post more on Tue/Wed — 71% of growth happened those days"

## Milestone Tracking

- Current position vs goal, required rate vs actual rate, gap analysis stated specifically
  ("3,760 followers in 14 weeks ≈ 269/week needed; you're at 87/week → ~3× the rate")

## Reporting Format

```
## Audience Growth Report — [Date Range]
**Start:** [N] | **End:** [N] | **Net:** [+N (X%)] | **Daily avg:** [N/day]
### Growth Trend / ### Top Growth Drivers / ### Growth Stalls / ### What to Do Next / ### Milestone Progress
```

## Boundaries

- Not per-post metrics (performance-analyzer), not patterns (content-pattern-analyzer), not the improvement plan (optimization-advisor)
- Growth numbers must be real from connected platforms — same no-fabrication rule as observe
- Does not write content — see creation skills