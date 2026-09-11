---
name: vervai-optimization-advisor
description: "Synthesize performance, pattern, and audience analysis into a prioritized, evidence-backed action plan — Quick Wins, Strategic Shifts, Experiments, and Things to Stop. Feeds the Vervai strategy engine's 'what should I publish next' answer with optimization direction. Use for 'what should I do next' / 'how do I improve'."
metadata:
  version: 1.0.0
---

# VervAI Optimization Advisor

Synthesizes everything known about a user's performance — metrics, patterns, growth,
and goals — into a prioritized, evidence-backed action plan. Diagnosis is not enough;
every recommendation ends with an action they can take this week, a reason grounded
in their own data, and a way to measure success.

## When to Use

- "What should I do next?" / "how do I improve" / "what's my biggest opportunity"
- After running performance-analyzer, content-pattern-analyzer, or audience-growth-tracker
- Producing the optimization half of the agent strategy response (`/api/agent/strategy/next`
  gives the *decision*; this gives the *improvement plan*)

## Data Synthesis

### Prior analysis available (preferred)
Build on findings from the sibling analysis skills. Look for convergence:
performance-analyzer says Tuesday educational threads win AND pattern-analyzer confirms
the list format outperforms → **high-confidence signal**, top-priority recommendation.

### No prior analysis
Run a quick assessment first: last 30 posts' ER (Buffer metrics), follower growth trend,
posting consistency. Do not present raw numbers — interpret directly into the framework.

### No data at all
Ask for the minimum: 2–3 best posts, 2–3 worst posts, posting frequency, primary goal
(growth/engagement/conversions). Work with rough answers; flag confidence.

## Recommendation Framework (present in this order)

### Tier 1 — Quick Wins (< 1 hour, immediate)
Execution adjustments, no new creation/platform changes. Each must cite a specific data point:
- "Start every post with a specific number — your top 3 posts average 3× baseline ER"
- "Shift Friday posts to Wednesday — Friday is 1.8% ER vs 5.1% Wednesday"
- "Add 'Save this for later' to educational posts — high impressions, 60% fewer saves"

Format: **Why** (evidence) → **Expected impact** → **Measure** (metric + window)

### Tier 2 — Strategic Shifts (2–4 weeks)
Content mix, platform focus, cadence changes. Must explain the trade-off, not just the upside:
- Shift 20% motivational → storytelling (worse by 40% on ER)
- Reduce frequency where dilution shows (ER drops on double-posting days)

### Tier 3 — Experiments (hypothesis-driven)
Structure: **Hypothesis** (if → then → because) / **Test** (what, how many, how long) /
**Success** (threshold) / **Failure** (when to drop). Use when data is promising but inconclusive.

### Tier 4 — Things to Stop
Evidence-based cuts, framed constructively — each "stop" includes what to do instead.
- "Stop promotional posts without a value hook — 0.9% ER vs 4.3% for insight-led"
- "Stop cross-posting identical content unadapted — underperforms native by 55%"

## Vervai Integration

- Feeds optimization direction into the strategy engine (`/api/agent/strategy/next`) — the
  deterministic `buildCandidates` stays the decision-maker; this skill supplies rationale quality
- Recommendations that reference the user's own published metrics must come from real
  Buffer data — same honesty rule as the observe endpoint. Never invent numbers.
- The advisory LLM rationale call can never override the deterministic decision.

## Output Format

```
## Your Optimization Plan — [Date]
**Based on:** [data sources] | **Primary opportunity:** [one-sentence summary]
### Quick Wins (this week) — N items
### Strategic Shifts (this month) — N items
### Experiments to Run — N items
### Stop Doing — N items
### Your #1 Priority — [one paragraph]
```

Max 10 items. 7 strong beats 10 diluted. Optionally note confidence calibration:
"limited sample (8 posts) — treat as an experiment, not a confirmed pattern."

## Boundaries

- Does not pull raw metrics (performance-analyzer), track growth (audience-growth-tracker), or detect patterns (content-pattern-analyzer) from scratch
- Does not write content — see creation skills
- Does not alter the deterministic strategy/observe decision paths