---
name: vervai-thread-writer
description: "Write multi-post threads (Twitter/X, LinkedIn series) with a strong opening hook, one idea per post, and a closing CTA. A new Vervai output capability driven by the intelligence layer's hooks/claims/stories evidence. Use when a single post cannot hold the idea."
metadata:
  version: 1.0.0
---

# VervAI Thread Writer

Writes multi-part content sequences — threads that educate, tell stories, share
frameworks, or document a journey. This is an **extension** of VervAI's generation
capability: VervAI has the evidence (any conversation worth a thread is in the
transcript), and this skill adds the structure.

## When to Use

- A transcript contains a framework, story arc, or list of lessons that exceeds one post
- User asks for a "thread," "tweetstorm," "multi-part post," or "series"
- The planner (`lib/agent/orchestrator/planner.ts`) is choosing between single-post
  and thread treatment for a strong claim/story insight

## Evidence Gates (from lib/intelligence)

A thread requires the following from the source's deterministic analysis:

- **Hooks** ≥ 2 (hook for post 1 + a variant hook for the closer)
- **Claims** ≥ 3 (one per body post minimum)
- **Stories or quotes** ≥ 1 for a story-arc thread

If the source does not have enough evidence, do not thread — emit a single post instead.

## Thread Architecture

### Post 1 — Hook
- One or two lines maximum. Ruthlessly specific (name the number/pain/transformation).
- Must stand alone as a compelling post.
- X: add "A thread:" or 🧵 on the same line; **do not** put "1/N" in post 1.
- If the hook underperforms the source's top hook from intelligence, prefer the intelligence hook.

### Body posts — one idea each
- One idea per post — if a post needs "and also…", split it.
- Each post stands alone (someone jumping in mid-thread should follow).
- End each post on a curiosity hook or micro-payoff that earns the next swipe.
- Vary post length — short punchy posts between longer ones reset attention.
- X: under 280 chars per post; number posts 2 onwards.

### Final post — Closer
- One sentence distilling the whole thread.
- Strong CTA: follow for more, save this, reply with their situation.
- Optional self-plug without making it the main event.

## Thread Formats (choose before writing)

| Format | Structure | Best for | Example opener |
|---|---|---|---|
| Listicle | "[N] things…" — one item per post | Tactical advice, mistakes | "7 writing habits that doubled my output in 90 days. (A thread:)" |
| Story arc | Setup → Conflict → Resolution → Lesson | Personal journey, case study | "3 years ago I was about to quit. Today…" |
| Framework | Name → step per post → output | Process, method | "The 5-step framework I use to write a month of content. (Save this.)" |
| Breakdown | Subject → components → lesson | Analysing a real example | "This post got 2M impressions. I broke down why." |
| Contrarian | Claim → common belief → evidence → nuance | Sparking debate | "Stop posting every day. It's hurting your growth. Here's the data:" |

## Platform Rules

- **Twitter/X**: 280 chars/post, numbered from post 2, self-reply chain, closer quotes the opener for a second reach window.
- **LinkedIn**: no native threading — a series is separate posts with "Thread (2/N):" labels; each post 200–600 chars; each post cross-links to the next.

## Output Shape

Emit the thread as an array of posts (one per entry), each with:

```
post: 1
text: <hook>
}  {post: 2, text: <body>} … {post: N, text: <closer + CTA>}
```

The evaluator (`lib/agent/evaluator.ts`) scores format-shape — threads must satisfy
the multi-part shape to pass. Each post is separately length-checked.

## Boundaries

- Does not write single posts — see post-writer skill
- Does not define new registry formats without going through `lib/output-registry/`
- Not for carousels — see carousel-writer skill
- Publishing stays manual (Buffer queue) — prefer numbering/scoping for scheduling spread