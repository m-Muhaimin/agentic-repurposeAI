---
name: vervai-caption-writer
description: "Write captions for visual-first platforms — Instagram, TikTok, Facebook, Pinterest, YouTube — where the visual carries the attention and the caption closes the loop. Extends Vervai's shortform_script output and generalizes the captioning capability to images, Reels, TikTok, Shorts, pins, and video descriptions."
metadata:
  version: 1.0.0
---

# VervAI Caption Writer

On visual platforms the visual stops the scroll; the caption closes the loop. This
skill writes captions that earn the "more" tap, reward the pause, and convert lurkers
into savers, sharers, and followers.

## When to Use

- The user provides a visual asset alongside a VervAI transcript (upload an image with the source)
- Generating supporting copy for a `shortform_script` (Reel/TikTok/Short caption)
- Extending distribution beyond the current text-first output set

## Universal Caption Anatomy

1. **Hook** — first 1–2 lines, before the truncation point; earns the "…more" tap
2. **Payoff** — the value, story, or insight the visual sets up
3. **CTA** — save, share, comment, follow, click (platform-native)

## Platform Rules

### Instagram
- Hook in first 125 chars (truncation); body builds on the visual, never just describes it
- 3–10 hashtags at end or first comment; **no clickable links** (bio); alt text on every asset
- Length by format: photo 80–300 chars, carousel 200–800, Reel 100–300
- Save/share CTAs: "Save this for later," "Send this to a friend"

### TikTok
- The video carries the hook; the caption adds context, punchline, or search keyword
- Caption indexed for in-app search — include keywords the audience would type
- 3–5 hashtags; under 150 chars typical; conversational, low-polish

### Facebook
- Conversational, story-driven; truncation ~120 chars mobile
- 40–80 chars sweet spot for photo posts; 300–500 for storytelling
- 1–3 hashtags only if branded/community; end with a direct question

### Pinterest
- A search engine, not a feed — title (≤100 chars, keyword-front-loaded) + description (≤500 chars)
- No hashtag reliance — natural keywords; "how to" / "ideas for" framings
- No emojis in titles; link in the dedicated field

### YouTube
- Title 60–70 chars (keyword + curiosity); Shorts caption <150 + #shorts
- Description: first 150 chars above the fold = hook; chapters for videos >3 min; ≤3 hashtags
- Community posts: text-first, Facebook-like tone

## Grounding

- Caption copy must trace to the source's intelligence evidence (a claim, hook, or quote)
- For `shortform_script` outputs, the registry's `requiresEvidence.minHooks` gate applies
- Never fabricates visual specifics — if a visual detail matters, it must come from the source or visual context

## Boundaries

- Extends the captioning capability, does not create new output registry ids without going through `lib/output-registry/`
- No visual design or image generation — text copy only
- Not for text-first platforms (LinkedIn/X/Threads/Bluesky) — see post-writer skill