---
name: vervai-platform-strategy
description: "Platform-specific tactical knowledge for LinkedIn, Twitter/X, Threads, Bluesky, and visual-first platforms — algorithm signals, post length sweet spots, formatting rules, hashtag counts, and register shifts. Use when generating a draft for a specific platform or deciding per-platform angle/format treatment inside the Vervai orchestrator."
metadata:
  version: 1.0.0
---

# VervAI Platform Strategy

The tactical field guide for each platform VervAI writes to. This is **injectable
knowledge** — every generation call targeting a platform should apply these rules
on top of the output-registry system prompt.

## When to Use

- Planning or executing a run whose plan targets a specific platform
- Choosing which angle + format pair fits a platform (used by `lib/agent/orchestrator/planner.ts`)
- Reviewing a draft for platform fitness before the evaluator scores format-shape

## LinkedIn

**Algorithm signals (ranked):**
1. Dwell time — long posts with line breaks keep people paused
2. Comments — weighted more than likes
3. Early engagement — first 60–90 min critical
4. Saves — "save this for later" CTAs

**Format rules:**
- 800–1300 characters (registry `linkedin_post` validation)
- Short paragraphs, ≤2 sentences each; never a wall of text
- **No links in the body** — linkedin suppresses reach; put links in first comment
- End with one genuine question, not a generic CTA
- 0–3 hashtags at the very end (VervAI default: none — hashtags are a user choice on /branding)
- First line must stop the scroll — treat it like a subject line

**Posting times:** Tuesday–Thursday, 7–9 AM or 12–1 PM (audience timezone).

## Twitter/X

**Algorithm signals (ranked):**
1. Replies — strongest signal
2. Quote tweets
3. Bookmarks — strong for educational threads
4. Likes — weighted lower

**Format rules:**
- Single tweet: under 280 chars, one tight unit (hook → core → CTA)
- Thread: hook tweet must stand alone and drive clicks to expand
- 0–2 hashtags maximum — hashtag stuffing kills reach
- No fluff — cut every word that doesn't earn its place
- Contrarian/bold/question hooks get most replies

**Thread recipe:**
- Post 1: hook + "A thread:" or 🧵 signal, **no** "1/N" numbering on tweet 1
- Each post: one idea, numbered, ends with reason to click next
- Closer: distil one takeaway + strong CTA (save thread / follow / reply)

## Threads

- Conversational, unpolished, human — closer to a group chat than a broadcast
- **Never** copy-paste an X thread; remove thread numbers, warm the tone
- 1–3 short paragraphs per post is fine; 500-char limit
- End with a genuine question or observation — reply culture is strong
- 0–1 hashtags, and often zero

## Bluesky

- Decentralized, early-adopter-heavy; values authenticity and anti-corporate tone
- 300-char limit; witty/dry register; no hashtag culture
- Use specific keywords (feeds are keyword-driven), not vague language
- Overt promotion is met with skepticism — lead with value

## Visual-First Rule Quick Reference

| Platform | Hook location | Hashtags | Link | Length |
|---|---|---|---|---|
| Instagram | First 125 chars of caption (+ on-screen for Reels) | 3–10 | bio, never caption | up to 2200 |
| TikTok | On-screen hook 0–3s (caption = SEO) ; registry shortform_script | 3–5 | bio | caption under 150 typ |
| Facebook | Line 1 (truncation ~120 chars mobile) | 1–3 | body OK | 300–500 story tell |
| Pinterest | Pin title (≤100 chars, keyword-front-loaded) | none | dedicated field | desc ≤500 |
| YouTube | Title 60–70 chars + first 5–8s of video | ≤3 | description | desc ≤5000, chapters >3min |

## Platform Selection (goal → platform)

| Goal | Best | Secondary |
|---|---|---|
| B2B leads | LinkedIn | Twitter/X |
| Thought leadership / career | LinkedIn | Bluesky |
| Community building | Threads | Bluesky |
| Audience growth (general) | Twitter/X | Threads |
| Tech / niche credibility | Bluesky | Twitter/X |
| Brand awareness (broad) | Twitter/X | LinkedIn |

## Cross-Posting Adaptation Checklist

Before scheduling the same piece to a second platform:
- [ ] LinkedIn: link in first comment, question ending, ≤2-sentence paragraphs
- [ ] X: single punchy post OR proper thread; box hashtags; CTA implicit or gone
- [ ] Threads: Twitter-specific conventions removed, tone warmed
- [ ] Bluesky: corporate/promotional language removed, keywords used naturally

## Boundaries

- Does not define output formats — see `lib/output-registry/`
- Does not decide the plan — it feeds angle/format-selection heuristics to `lib/agent/orchestrator/planner.ts`
- Does not override the deterministic evaluator — format-shape scoring is in `lib/agent/evaluator.ts`