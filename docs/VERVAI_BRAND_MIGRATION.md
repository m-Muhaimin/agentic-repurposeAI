# VervAI Brand Migration — Complete Repository Audit

**Status**: Audit complete — ready for migration work.
**Date**: 2026-09-08
**New product name**: VervAI
**Product promise**: "Turn your content into your next best content."
**Important**: The Agent is a capability inside VervAI, NOT the product name. Never call it "VervAI Agent" in UI.

---

## 1. Complete Occurrence Table

### 1.1 User-facing brand strings (REPLACE)

| # | File:line | Old text | Classification | Action |
|---|-----------|----------|----------------|--------|
| 1 | `app/layout.tsx:18` | `title: "Repurpose AI — one recording, three posts"` | SEO / UI | Replace title. New: `"VervAI — turn your content into your next best content"` |
| 2 | `components/logo.tsx:8` | `alt="Repurpose AI"` | UI / Accessibility | Replace alt text. New: `alt="VervAI"` |
| 3 | `components/logo.tsx:22` | `Repurpose` (wordmark text) | UI / Branding | Replace. New: `VervAI` |
| 4 | `components/app-shell.tsx:441` | `<span className="...">Repurpose</span>` (wordmark in top bar) | UI / Branding | Replace. New: `VervAI` |
| 5 | `components/footer.tsx:19` | `{ label: "Repurpose content", href: "/upload" }` | UI / Nav | Replace label. New: `"Create content"` or `"VervAI"` — see URL section |
| 6 | `components/footer.tsx:92` | `© 2026 Repurpose AI` | UI / Legal footer | Replace. New: `© 2026 VervAI` |
| 7 | `components/create-menu.tsx:15` | `title: "Repurpose a recording"` | UI / Action label | Replace. New: `"Create content"` or `"Turn content into more"` |
| 8 | `components/branding-form.tsx:160` | `description="Teach RepurposeAI how you sound..."` | UI / Feature copy | Replace. New: `"Teach VervAI how you sound..."` |
| 9 | `components/branding-form.tsx:242` | `Fine-tune how RepurposeAI writes...` | UI / Feature copy | Replace. New: `Fine-tune how VervAI writes...` |
| 10 | `components/branding-form.tsx:64` | `text: "...repurpose something first..."` | UI / Error copy | Replace verb. New: `"...create something first..."` (generic verb, not brand) |
| 11 | `components/branding-form.tsx:220` | `Repurpose something` (button/label) | UI / Action | Replace. New: `Create something` |
| 12 | `app/page.tsx:108` | `quote: "...RepurposeAI keeps my voice..."` | SEO / Marketing | Replace. New: `"...VervAI keeps my voice..."` |
| 13 | `app/page.tsx:177` | `While RepurposeAI is in beta...RepurposeAI...` | SEO / Marketing | Replace both. New: `While VervAI is in beta...VervAI...` |
| 14 | `app/page.tsx:180` | `q: "What counts as a repurpose job?"` | SEO / Marketing | Replace. New: `q: "What counts as a creation job?"` or `"What's a VervAI job?"` |
| 15 | `app/page.tsx:291` | `repurpose.ai` (domain reference) | SEO / Domain | Preserve for now (see URL section) or update to `vervai.com` when domain changes |
| 16 | `app/page.tsx:385` | `body="...RepurposeAI does the writing..."` | SEO / Marketing | Replace. New: `"...VervAI does the writing..."` |
| 17 | `app/page.tsx:507` | `body="We're validating RepurposeAI in the open..."` | SEO / Marketing | Replace. New: `"We're validating VervAI in the open..."` |
| 18 | `app/page.tsx:34` (approx) | `one recording, three posts` (tagline in layout) | SEO / Tagline | Replace with VervAI promise: `"turn your content into your next best content"` |
| 19 | `app/login/page.tsx:254` | `Beta is free — your first 5 repurpose jobs...` | UI / Pricing copy | Replace. New: `your first 5 creation jobs` or `your first 5 VervAI jobs` |
| 20 | `app/(app)/dashboard/page.tsx:34-35` | `${usage.jobsUsed} repurpose jobs used...` | UI / Dashboard | Replace. New: `creation jobs` or `VervAI jobs` — see lib/billing for source |
| 21 | `app/(app)/dashboard/page.tsx:219` | `Nothing here yet — repurpose your first piece...` | UI / Empty state | Replace verb. New: `create your first piece...` |
| 22 | `app/(app)/library/page.tsx:40` | `Everything you've repurposed...` | UI / Page heading | Replace. New: `Everything you've created...` |
| 23 | `app/(app)/library/page.tsx:61` | `Repurpose content` (CTA) | UI / CTA | Replace. New: `Create content` |
| 24 | `app/(app)/library/source-list.tsx:359` | `description="Repurpose a recording..."` | UI / Hero text | Replace. New: `Create content from a recording...` |
| 25 | `app/(app)/library/source-list.tsx:362` | `Repurpose content` (button) | UI / Button | Replace. New: `Create content` |
| 26 | `app/(app)/upload/page.tsx:67` | `setNotice("YouTube connected — repurpose your videos...")` | UI / Toast | Replace verb. New: `...create from your videos...` |
| 27 | `app/(app)/upload/page.tsx:407` | `description="...RepurposeAI will turn it into ready-to-edit drafts."` | UI / Hero | Replace. New: `...VervAI will turn it into ready-to-edit drafts.` |
| 28 | `app/(app)/upload/page.tsx:572` | `Connect your YouTube channel to repurpose your own videos...` | UI / Feature | Replace verb. New: `...create from your own videos...` |
| 29 | `app/(app)/settings/usage/page.tsx:116` | `Repurpose jobs are budgeted per calendar month...` | UI / Settings | Replace. New: `Creation jobs are budgeted...` |
| 30 | `app/(app)/settings/usage/page.tsx:125` | `description="Your most recent repurpose jobs..."` | UI / Settings | Replace. New: `Your most recent creation jobs...` |
| 31 | `app/(app)/settings/usage/page.tsx:129` | `No jobs yet this cycle — repurpose your first piece...` | UI / Empty state | Replace verb. New: `create your first piece...` |
| 32 | `app/(app)/connections/page.tsx:58` | `description="...so RepurposeAI can work with it directly."` | UI / Connections | Replace. New: `...so VervAI can work with it directly.` |
| 33 | `app/legal/privacy/page.tsx:6` | `title: "Privacy Policy — Repurpose AI"` | SEO / Legal | Replace. New: `title: "Privacy Policy — VervAI"` |
| 34 | `app/legal/terms/page.tsx:6` | `title: "Terms of Service — Repurpose AI"` | SEO / Legal | Replace. New: `title: "Terms of Service — VervAI"` |
| 35 | `app/legal/terms/page.tsx:15` | `Repurpose AI (the "service") takes audio/video...` | SEO / Legal | Replace. New: `VervAI (the "service") takes audio/video...` |
| 36 | `app/legal/terms/page.tsx:18` | `deal between you and the maintainer of Repurpose AI.` | SEO / Legal | Replace. New: `...maintainer of VervAI.` |
| 37 | `app/legal/terms/page.tsx:27` | `to repurpose it.` (verb) | Legal / Verb | Preserve — generic verb, not brand |
| 38 | `app/legal/terms/page.tsx:66` | `own that was repurposed without permission` (verb) | Legal / Verb | Preserve — generic verb |
| 39 | `components/output-editor.tsx:224` | `"Generated from your recording with Repurpose AI"` | UI / Editor footer | Replace. New: `"Generated from your recording with VervAI"` |
| 40 | `components/usage-meter.tsx:60` | `You've used all {usage.limit} repurpose jobs...` | UI / Usage meter | Replace. New: `creation jobs` — delegated to lib/billing source string |
| 41 | `components/agent/opportunity-feed.tsx:180` | `No sources with a ready transcript — repurpose something first.` | UI / Agent | Replace verb. New: `create something first.` |
| 42 | `components/agent/outcome-composer.tsx:175` | `No ready sources yet — repurpose something first.` | UI / Agent | Replace verb. New: `create something first.` |
| 43 | `components/dashboard/objective-prompt.tsx:21` | `{ href: "/upload", title: "Repurpose a recording", detail: "..." }` | UI / Dashboard card | Replace title. New: `"Create content"` |
| 44 | `components/dashboard/opportunity-next.tsx:135` | `Repurpose content` (button) | UI / Dashboard | Replace. New: `Create content` |
| 45 | `components/connections-youtube.tsx:75` | `Repurpose videos straight from their authorized captions...` | UI / YouTube connect | Replace verb. New: `Create from videos straight from...` |
| 46 | `app/api/prompts/analyze-voice/route.ts:19` | `You are RepurposeAI's voice assistant...` | Backend / AI prompt | Replace. New: `You are VervAI's voice assistant...` |
| 47 | `lib/ai/openrouter.ts:24` | `"X-Title": "Repurpose AI"` | Backend / API header | Replace. New: `"X-Title": "VervAI"` |
| 48 | `lib/ingestion/url-fetch.ts:58` | `"user-agent": "RepurposeAI-ingestion/1.0"` | Backend / User-agent | Replace. New: `"user-agent": "VervAI-ingestion/1.0"` |
| 49 | `lib/billing/plans.ts:85` | `"5 repurpose jobs / month"` (plan feature list) | Backend / Billing | Replace. New: `"5 creation jobs / month"` |
| 50 | `lib/billing/plans.ts:88` | `"Brand Voice + repurpose prompts"` | Backend / Billing | Replace. New: `"Brand Voice + creation prompts"` |
| 51 | `lib/billing/usage.ts:114` | `"You've used all your repurpose jobs for this month..."` | Backend / Usage message | Replace. New: `"You've used all your creation jobs for this month..."` |
| 52 | `lib/agent/outcomes.ts:49` | `chip: "Repurpose"` (agent intent chip label) | UI / Agent intent | **PRESERVE** — this is the agent intent name, not the product name. The agent runs inside VervAI; "Repurpose" is a capability label. See Compatibility Exceptions. |
| 53 | `lib/ingestion/providers/ytdlp.ts:146` | `fs.mkdtempSync(path.join(os.tmpdir(), "repurpose-yt-"))` | Backend / Temp dir | **PRESERVE** — implementation detail, not user-facing. See Compatibility Exceptions. |

### 1.2 API route references (PRESERVE — code identifiers)

| # | File:line | Text | Why preserve |
|---|-----------|------|-------------|
| 54 | `app/api/repurpose/route.ts:3` | `checkRepurposeRateLimit` (import) | Function name — code identifier |
| 55 | `app/api/repurpose/route.ts:77` | `checkRepurposeRateLimit(user.id)` | Function call |
| 56 | `app/api/repurpose/route.ts:79` | `log.warn("repurpose.rate_limited", ...)` | Event name — analytics |
| 57 | `app/api/repurpose/route.ts:111` | `log.error("repurpose.enqueue_rpc_failed", ...)` | Event name |
| 58 | `app/api/repurpose/route.ts:127` | `log.info("repurpose.limit_reached", ...)` | Event name |
| 59 | `app/api/repurpose/route.ts:135` | `feature: "repurpose_job"` | Feature flag name |
| 60 | `app/api/repurpose/route.ts:157` | `feature: "repurpose_job"` | Feature flag name |
| 61 | `app/api/repurpose/route.ts:168` | `log.error("repurpose.enqueue_rpc_no_job", ...)` | Event name |
| 62 | `app/api/repurpose/route.ts:177` | `log.info("repurpose.idempotent_replay", ...)` | Event name |
| 63 | `app/api/repurpose/route.ts:199` | `log.info("repurpose.enqueued", ...)` | Event name |
| 64 | `app/api/repurpose/route.ts` (all) | Route file: `app/api/repurpose/route.ts` | API endpoint path — preserved for backward compat |
| 65 | `lib/rate-limit.ts:15` | `checkRepurposeRateLimit` | Function name |
| 66 | `lib/rate-limit.ts:7` | `REPURPOSE_RATE_LIMIT_PER_MIN` import | Constant name |
| 67 | `lib/limits.ts:64` | `export const REPURPOSE_RATE_LIMIT_PER_MIN` | Env-derived constant |
| 68 | `lib/limits.ts:77` | `process.env.REPURPOSE_RATE_LIMIT_PER_MIN` | Env var name |
| 69 | `lib/agent/outcomes.ts:12,20,47-49` | `"repurpose"` intent id + chip | Agent intent — capability label inside VervAI |
| 70 | `lib/agent/outcomes.ts:137` | Regex test for `"repurpose"` intent detection | Intent detection — capability |
| 71 | `lib/agent/outcomes.test.ts:19,54,91,96` | Test assertions on `"repurpose"` intent | Tests for intent — must stay |
| 72 | `lib/agent/planner.ts:21` | `angles that a creator could repurpose this recording into` | Comment — describes capability |
| 73 | `lib/agent/strategy.ts:149` | `detail: "Source has no ready transcript — finish transcription or repurpose first."` | UI string from agent — replace verb |
| 74 | `lib/agent/tools/generation.ts:3,51` | Comments referencing `/repurpose/[id]` and "generic repurpose" | Implementation comments — can stay or update |
| 75 | `lib/ingestion/engines.test.ts:23,33` | `"REPURPOSE FAST"` test fixture text | Test fixture — not user-facing |
| 76 | `lib/ingestion/normalize.test.ts:60` | `"nothing to repurpose"` error message test | Test — error message source is normalize.ts |
| 77 | `lib/ingestion/normalize.ts:55` | `throw ingestionFailure("Extracted content is empty — nothing to repurpose.", ...)` | Error message — user-visible via API. Replace verb. |
| 78 | `lib/ingestion/providers/ytdlp.ts:29` | `"This video is private — only public videos can be repurposed."` | Error message — user-visible. Replace verb. |
| 79 | `lib/intelligence/extract.ts:381` | `pitch: "A single strong, quotable claim is the highest-signal repurpose..."` | AI prompt/internal — can stay |
| 80 | `app/api/agent/runs/route.ts:39` | `// (a done repurpose job produced it).` | Comment |
| 81 | `app/api/agent/strategy/next/route.ts:71` | `"...Repurpose or finish transcription on a source first."` | API response body — user-visible. Replace verb. |
| 82 | `app/api/integrations/youtube/videos/route.ts:7` | `// The connected user's most recent uploads, for the "Repurpose one of mine"` | Comment |
| 83 | `app/globals.css:190` | `/* == Markdown preview (renders generated drafts in /repurpose/[id]) == */` | CSS comment |
| 84 | `middleware.ts:39` | `"/repurpose"` (protected path) | URL route — preserved for compat |
| 85 | `components/app-shell.tsx:277` | `// nav entries map back to their parent — the editor (/repurpose/*) resolves` | Comment |
| 86 | `components/app-shell.tsx:280` | `if (pathname.startsWith("/repurpose/")) return "/library";` | URL routing logic — preserved |

### 1.3 Documentation files (REPLACE or UPDATE)

| # | File:line | Old text | Action |
|---|-----------|----------|--------|
| 87 | `README.md:1` | `# Repurpose AI` | Replace H1. New: `# VervAI` |
| 88 | `README.md:53` | `POST /api/repurpose is enqueue-only` | Preserve (API route name) |
| 89 | `README.md:57` | `Drafts are edited/regenerated/copied in /repurpose/[id]` | Preserve (URL route) |
| 90 | `docs/AGENTIC_ROADMAP.md:1` | `# Agentic RepurposeAI — Roadmap` | Replace H1. New: `# Agentic VervAI — Roadmap` |
| 91 | `docs/AGENTIC_ROADMAP.md:30` | `agentic drafts show up in /library and the /repurpose/[id] editor` | Preserve URL, replace product name if "RepurposeAI" appears |
| 92 | `docs/AGENTIC_ROADMAP.md:80` | `/api/repurpose enqueue path` | Preserve API route |
| 93 | `docs/IMPLEMENTATION_MAP.md:1` | `# Implementation Map — RepurposeAI (agentic-v4)` | Replace H1. New: `# Implementation Map — VervAI (agentic-v4)` |
| 94 | `docs/IMPLEMENTATION_MAP.md:57` | `POST /api/repurpose enqueues a jobs row` | Preserve API route |
| 95 | `docs/IMPLEMENTATION_MAP.md:83` | `/library and the /repurpose/[id] editor` | Preserve URL |
| 96 | `docs/IMPLEMENTATION_MAP.md:227` | `middleware.ts protects /dashboard /upload /repurpose` | Preserve URL |
| 97 | `docs/IMPLEMENTATION_MAP.md:231` | `/repurpose/[id] (output editor...)` | Preserve URL |
| 98 | `docs/IMPLEMENTATION_MAP.md:237` | `create|plan|repurpose|improve|find_opportunities|build_week` | Preserve intent names |
| 99 | `docs/agentic-v2-audit.md:1` | `# Agentic RepurposeAI V2 — Phase 0 Repository Audit` | Replace H1. New: `# Agentic VervAI V2 — Phase 0 Repository Audit` |
| 100 | `docs/agentic-v2-audit.md:15` | `POST /api/repurpose enqueues a row` | Preserve API route |
| 101 | `docs/agentic-v2-audit.md:22` | `/library and /repurpose/[id]` | Preserve URL |
| 102 | `docs/agentic-v2-audit.md:56` | `repurpose/[id] viewer` | Preserve URL |
| 103 | `docs/agentic-v2-audit.md:58` | `/dashboard, /upload, /repurpose, /branding...` | Preserve URL list |
| 104 | `docs/agentic-v2-audit.md:115` | `the base repurpose path bills through enqueue_job` | Preserve — describes mechanism |
| 105 | `docs/production-audit.md:1` | `# Production Readiness Audit — RepurposeAI` | Replace H1. New: `# Production Readiness Audit — VervAI` |
| 106 | `docs/production-audit.md:18` | `quick-repurpose card` | Replace — UI element name |
| 107 | `docs/production-audit.md:21` | `/repurpose/[id] | app | Draft editor` | Preserve URL |
| 108 | `docs/production-audit.md:41` | `/library and /repurpose/[id] not yet read` | Preserve URL |
| 109 | `docs/production-audit.md:49` | `/api/repurpose | POST | session` | Preserve API route |
| 110 | `docs/production-audit.md:69` | `/api/repurpose returns immediately` | Preserve API route |
| 111 | `docs/production-audit.md:88` | `https://repurpose-ai-swart.vercel.app` | **PRESERVE** — Vercel deployment URL. See Compatibility Exceptions. |
| 112 | `docs/production-audit.md:95` | `REPURPOSE_RATE_LIMIT_PER_MIN` | Preserve env var |
| 113 | `docs/production-audit.md:134` | `No integration tests for /api/repurpose` | Preserve API route |
| 114 | `docs/production-audit.md:186` | `/api/process), /api/repurpose enqueue` | Preserve API route |
| 115 | `docs/production-audit.md:205` | `/api/repurpose's formats-fallback` | Preserve API route |
| 116 | `docs/production-audit.md:213` | `/api/repurpose now calls public.enqueue_job(...)` | Preserve API route |
| 117 | `docs/production-audit.md:223` | `Dead fallback regexes in /api/repurpose` | Preserve API route |
| 118 | `docs/ROADMAP.md:6` | `/api/repurpose is enqueue-only` | Preserve API route |
| 119 | `docs/ROADMAP.md:17` | `ownership .eq("user_id", user.id) in repurpose, sources...` | Preserve — code reference |
| 120 | `docs/ROADMAP.md:33` | `Rate limiting /api/repurpose` | Preserve API route |
| 121 | `docs/ROADMAP.md:52` | `re-enqueues via /api/repurpose` | Preserve API route |
| 122 | `docs/ROADMAP.md:60` | `job claim/complete/fail in /api/process, /api/repurpose` | Preserve API routes |
| 123 | `docs/ROADMAP.md:68` | `Plain-English pages at /legal/terms + /legal/privacy...support@repurpose-ai.app` | Replace email. New: `support@vervai.com` (or new support address) |
| 124 | `docs/UX_AUDIT.md:1` | `# UX Audit — RepurposeAI (Phase 0)` | Replace H1. New: `# UX Audit — VervAI (Phase 0)` |
| 125 | `docs/UX_AUDIT.md:23` | `4 | /repurpose/[id] | ...` | Preserve URL |
| 126 | `docs/UX_AUDIT.md:35` | `protectedPaths = [/dashboard, /upload, /repurpose, ...]` | Preserve URL list |
| 127 | `docs/UX_AUDIT.md:37` | `/api/agent/*, /api/repurpose/*, ...` | Preserve API route list |
| 128 | `docs/UX_AUDIT.md:59` | `/repurpose/[id] never has an active nav item` | Preserve URL |
| 129 | `docs/UX_AUDIT.md:64` | `Sticky top bar with wordmark "Repurpose"` | Replace — describes current UI |
| 130 | `docs/UX_AUDIT.md:69` | `No global "Repurpose / Create" CTA` | Replace — describe new CTA |
| 131 | `docs/UX_AUDIT.md:85` | `H1: "Repurpose content" (header)` | Replace — describes current UI |
| 132 | `docs/UX_AUDIT.md:94` | `H1: "Repurpose content" submit` | Replace |
| 133 | `docs/UX_AUDIT.md:101` | `H1: "Repurpose content" (header)` | Replace |
| 134 | `docs/UX_AUDIT.md:104` | `FORMAT_LABEL re-declared here and again in /repurpose/[id]` | Preserve URL |
| 135 | `docs/UX_AUDIT.md:106` | `Draft editor — app/repurpose/[id]/page.tsx` | Preserve URL |
| 136 | `docs/UX_AUDIT.md:117` | `H1: "Start agent run"...intent chips (Create / Plan / Repurpose / Improve...)` | Replace "Repurpose" chip label? — see Compatibility Exceptions |
| 137 | `docs/UX_AUDIT.md:152` | `no push to the publish queue or to repurpose` | Replace verb |
| 138 | `docs/UX_AUDIT.md:197` | `Primary "Create/Repurpose" shell CTA` | Replace |
| 139 | `docs/UX_AUDIT.md:203` | `FORMAT_LABEL...app/repurpose/[id]/page.tsx` | Preserve URL |
| 140 | `docs/UX_AUDIT.md:236` | `Create (Agent, Upload, Quick Repurpose)` | Replace — describe new naming |
| 141 | `docs/UX_AUDIT.md:248` | `Draft editor is a dead end (/repurpose/[id])` | Preserve URL |
| 142 | `docs/UX_AUDIT.md:253` | `Connected channels are dead ends (only Disconnect; no repurpose/publish push)` | Replace verb |
| 143 | `docs/UX_AUDIT.md:263` | `Add a global "Repurpose / Create" CTA` | Replace — new CTA naming |
| 144 | `docs/UX_AUDIT.md:264` | `keep /repurpose/[id] resolving to Library` | Preserve URL |
| 145 | `docs/UX_AUDIT.md:269` | `Give connected-channel and dashboard rows an onward action (repurpose / open drafts)` | Replace verb |
| 146 | `docs/UX_AUDIT.md:276` | `Editor nav identity: does /repurpose/[id] sit under Library` | Preserve URL |
| 147 | `docs/legal-review.md:13` | `Do NOT ship support@repurpose-ai.app` | Replace email. New: `support@vervai.com` |
| 148 | `docs/data-model.md:33` | `Usage enforcement is ATOMIC, in the DB (P3): /api/repurpose does NOT` | Preserve API route |

### 1.4 Database / Migration / Schema (PRESERVE — never change)

| # | File:line | Text | Why preserve |
|---|-----------|------|-------------|
| 149 | `supabase/schema.sql:191` | `-- The /api/repurpose route only enqueues work here...` | Comment referencing API route — preserve |
| 150 | `supabase/schema.sql:226` | `-- Speeds up the per-user rate limit check in /api/repurpose` | Comment — preserve |
| 151 | `supabase/schema.sql:403` | `-- repurpose job (retries, double clicks...) never consumes two jobs.` | Comment — preserve |
| 152 | `supabase/migrations/20260907000001_initial.sql:76` | `-- /api/repurpose only enqueues work here...` | Comment — preserve |
| 153 | `supabase/migrations/20260907000001_initial.sql:111` | `-- Speeds up the per-user rate limit check in /api/repurpose.` | Comment — preserve |
| 154 | `supabase/migrations/20260907000002_profiles_events.sql:59` | `-- repurpose job (retries, double clicks...) never consumes two jobs.` | Comment — preserve |
| 155 | `supabase/migrations/20260907000005_agentic_v4_tables.sql:1` | `-- Agentic V4 schema (P1): the six V4_ tables that ship the Agentic RepurposeAI` | Comment — can update |
| 156 | `supabase/schema_agentic.sql:1` | `-- Agentic RepurposeAI — additive schema.` | Comment — can update |
| 157 | `package.json:2` | `"name": "repurpose-ai"` | **PRESERVE** — package name for deployment compat. See section 4. |
| 158 | `.env.example:82` | `# REPURPOSE_RATE_LIMIT_PER_MIN=10` | **PRESERVE** — env var name |
| 159 | `AGENTS.md:24` | `REPURPOSE_RATE_LIMIT_PER_MIN (default 10)` | **PRESERVE** — env var reference |
| 160 | `AGENTS.md:97` | `Vercel: project repurpose-ai on team fragile-frogs` | **PRESERVE** — Vercel project name |

### 1.5 Additional files checked (no RepurposeAI/Repurpose brand strings found)

The following files were searched and contain **only** the generic verb "repurpose" (lowercase, as a verb describing the action) or code references to `/repurpose/` routes. These do NOT require brand replacement:

- `app/(app)/repurpose/[id]/page.tsx` — page component for the editor route. File path and route are preserved. Contains generic verb usage only.
- `components/agent/*.tsx` (other than those listed above) — agent UI components. Intent names preserved.
- `app/(app)/content/calendar/page.tsx` — no repurpose brand strings.
- `app/(app)/publish/page.tsx` — no repurpose brand strings.
- `app/api/**/*.ts` (other than those listed) — API routes. No brand strings.
- `supabase/migrations/*.sql` (other than those listed) — migration files. Comments only.

---

## 2. Classification Summary Counts

| Classification | Count | Action |
|----------------|-------|--------|
| **User-facing UI strings** (replace) | ~46 | Replace "RepurposeAI" / "Repurpose AI" / "Repurpose" (brand) with "VervAI" / "Create" |
| **Marketing/SEO copy** (replace) | ~10 | Replace in app/page.tsx, README.md, docs headers |
| **Legal pages** (replace) | ~4 | Privacy, Terms titles + body |
| **Backend AI prompts / headers** (replace) | ~3 | System instructions, user-agent, X-Title |
| **Billing/usage messages** (replace) | ~4 | Plan features, usage meter text |
| **API route names** (preserve) | ~15 | `/api/repurpose/*`, function names, event names |
| **URL routes** (preserve) | ~15 | `/repurpose/[id]`, `/repurpose/*`, middleware paths |
| **Database/schema** (preserve) | ~10 | Table names, column names, migration comments |
| **Package/deployment** (preserve) | ~3 | package.json name, Vercel project, env var |
| **Agent intent names** (preserve) | ~8 | "repurpose" as a capability inside VervAI |
| **Generic verb "repurpose"** (replace or preserve) | ~20 | Lowercase verb in UI copy — replace with "create"; in code/comments — leave |
| **Docs headers** (replace) | ~8 | AGENTIC_ROADMAP, IMPLEMENTATION_MAP, ROADMAP, UX_AUDIT, production-audit, agentic-v2-audit |

**Total occurrences examined**: ~160 across the repository (excluding package-lock.json and build artifacts).

---

## 3. Compatibility Exceptions — What Stays and WHY

### 3.1 Package name: `repurpose-ai` (PRESERVE)

**File**: `package.json:2` — `"name": "repurpose-ai"`

**Decision**: Keep as-is. Do NOT rename.

**Why**:
- Vercel project is linked to this package name. Renaming breaks the Vercel linkage.
- The Vercel deployment URL is `https://repurpose-ai-swart.vercel.app` — tied to the project name.
- npm package name (even if private) may be referenced in CI/CD, lockfiles, or deployment scripts.
- Changing `package.json` name requires re-linking Vercel, updating any `package.json` references in scripts, and potentially breaking `vercel link` state.

**Migration path**: If/when VervAI gets its own domain and Vercel project, create a NEW Vercel project named `vervai` and migrate deployment there. Until then, keep `repurpose-ai` as the package name and document it as a deployment-compatible alias.

### 3.2 Vercel deployment URL: `repurpose-ai-swart.vercel.app` (PRESERVE)

**File**: `docs/production-audit.md:88`

**Decision**: Keep the existing Vercel URL until a custom domain (`vervai.com` or similar) is configured.

**Why**:
- Vercel project names map to URLs. Changing the project name changes the URL.
- Users, bookmarks, shared links, and any external references point here.
- Custom domain can be added alongside the Vercel URL; switch traffic when ready.

### 3.3 Support email: `support@repurpose-ai.app` (REPLACE)

**Files**: `docs/legal-review.md:13`, `docs/ROADMAP.md:68`, `app/legal/terms/page.tsx:66`

**Decision**: Replace with `support@vervai.com` (or whatever the actual support address becomes).

**Why**: This is a user-facing contact address. It MUST change with the brand. The legal-review.md explicitly flags this as a blocker — it must be replaced before launch.

### 3.4 URL routes: `/repurpose/*` and `/api/repurpose` (PRESERVE)

**Files**: `middleware.ts:39`, `components/app-shell.tsx:280`, all API routes, all doc references to these paths

**Decision**: Keep all `/repurpose/` and `/api/repurpose` routes as-is for now.

**Why**:
- These are deep-linked URLs. Users may have bookmarks, shared links, or OAuth redirect URLs pointing to `/repurpose/[id]`.
- API clients (if any external) may call `/api/repurpose`.
- Breaking these URLs is a user-facing regression.
- The `middleware.ts` protected paths list includes `/repurpose` — changing it requires coordinated updates.

**Migration path**:
1. Keep `/repurpose/*` routes working and redirecting to the new VervAI equivalent (e.g., `/create/[id]` or `/library/[id]`) via Next.js middleware redirects.
2. Add new VervAI routes alongside the old ones.
3. After a transition period, remove old routes and update middleware.
4. Document the redirect map in this migration file.

### 3.5 Database: table names, column names, migration names (PRESERVE)

**Files**: `supabase/schema.sql`, `supabase/migrations/*.sql`, `lib/rate-limit.ts` (references `jobs` table)

**Decision**: Do NOT rename any database objects.

**Why**:
- Migration files are immutable once applied. Renaming would require a new migration that renames back — error-prone and unnecessary.
- The `jobs` table, `outputs` table, `sources` table, and all columns are internal implementation details. Users never see these names.
- `enqueue_job` RPC, `jobs_user_created_idx` index — all internal. Code references (e.g., `checkRepurposeRateLimit`) are code identifiers, not user-facing.

### 3.6 Code identifiers: function names, event names, env vars (PRESERVE)

**Examples**: `checkRepurposeRateLimit`, `repurpose.rate_limited`, `repurpose.enqueued`, `REPURPOSE_RATE_LIMIT_PER_MIN`, `repurpose_job` feature flag

**Decision**: Keep all code identifiers as-is.

**Why**:
- These are internal implementation details. Changing them has no user-facing benefit and risks breaking code, logs, analytics pipelines, and rate-limit logic.
- Analytics event names (`repurpose.*`) may be tracked in external analytics tools. Renaming would break time-series continuity.
- Env var `REPURPOSE_RATE_LIMIT_PER_MIN` is set in hosting environments. Changing it requires redeploying with new env vars.

### 3.7 Agent intent name: `"repurpose"` (PRESERVE)

**Files**: `lib/agent/outcomes.ts:12,20,47-49,137`, `lib/agent/outcomes.test.ts`

**Decision**: Keep `"repurpose"` as an intent ID and chip label.

**Why**: The Agent is a capability INSIDE VervAI. "Repurpose" is the name of one of the six agent intents (Create / Plan / Repurpose / Improve / Find opportunities / Build a week). It describes what the agent does with content — it is NOT the product name. Calling the intent "Create" would confuse it with the top-level "Create content" action. The intent chip "Repurpose" is accurate: the agent repurposes your content into new formats.

**Note**: The UX audit flags that the agent intent chip "Repurpose" could be confusing alongside the product name. If the product is VervAI, consider renaming the intent chip to something like "Repurpose" → "Remix" or "Reconstruct" — but this is a UX decision, not a brand migration requirement. Document the decision separately.

### 3.8 Temp directory: `repurpose-yt-` (PRESERVE)

**File**: `lib/ingestion/providers/ytdlp.ts:146`

**Decision**: Keep as-is. It's a local temp dir prefix, never user-facing.

### 3.9 Test fixtures and test assertions (PRESERVE where they test behavior)

**Files**: `lib/ingestion/engines.test.ts:23,33`, `lib/ingestion/normalize.test.ts:60`, `lib/agent/outcomes.test.ts`

**Decision**: Tests that assert on `"repurpose"` as an intent ID or functional behavior must stay. Tests that assert on user-facing error messages should be updated to match new copy.

---

## 4. Package Naming Decision

| Item | Current value | Decision | Rationale |
|------|---------------|----------|-----------|
| `package.json` `name` | `repurpose-ai` | **KEEP** | Vercel project linkage, deployment URL, lockfile references. Renaming breaks deployment chain. |
| Vercel project name | `repurpose-ai` (via `.vercel/project.json`) | **KEEP** until custom domain | Deployment URL is `repurpose-ai-swart.vercel.app`. Changing project name changes URL. |
| npm package (if published) | `repurpose-ai` | **KEEP** or publish new `vervai` package | If ever published to npm, publish `vervai` as a new package. Don't unpublish `repurpose-ai`. |
| Import paths in code | `@/lib/...`, `@/components/...` | **UNCHANGED** | Aliased imports don't reference package name. |

**Documentation**: Add a note to `README.md` and `docs/VERVAI_BRAND_MIGRATION.md`:
> The npm package name `repurpose-ai` and Vercel project name `repurpose-ai` are preserved for deployment compatibility. The product is VervAI. The package name is an implementation detail, not a brand signal.

---

## 5. Database Decisions

| Object | Current name | Decision | Rationale |
|--------|-------------|----------|-----------|
| `jobs` table | `jobs` | **PRESERVE** | Internal. No user exposure. Migration 0001 already applied. |
| `outputs` table | `outputs` | **PRESERVE** | Internal. |
| `sources` table | `sources` | **PRESERVE** | Internal. |
| `v4_content_ideas` table | `v4_content_ideas` | **PRESERVE** | Internal. Agentic V4 schema. |
| `enqueue_job` RPC | `public.enqueue_job` | **PRESERVE** | Called by `/api/repurpose`. Internal. |
| `jobs_user_created_idx` | index name | **PRESERVE** | Internal. |
| Migration files | `20260907000001_initial.sql`, etc. | **PRESERVE** | Immutable once applied. Comments can be updated in new docs but NOT in migration files. |
| Column names | `user_id`, `status`, `formats`, etc. | **PRESERVE** | Internal. |

**Rule**: Database objects are implementation details. They are never user-facing. Renaming them provides zero brand value and risks data integrity. Preserve all DB names forever.

---

## 6. URL / Domain Decisions

### 6.1 Current routes to preserve

| Route | Current purpose | Preservation rationale | Migration action |
|-------|----------------|----------------------|------------------|
| `/repurpose/[id]` | Draft editor | Deep links, bookmarks, shared URLs | Add redirect to new route; keep working during transition |
| `/api/repurpose` | Job enqueue API | API clients, internal code references | Keep endpoint; add new `/api/create` or `/api/generate` alongside |
| `/repurpose` (middleware) | Auth protection | Middleware path list | Keep in middleware; add new paths |
| `/upload` | Upload page | Current creation entry point | Rename UI label to "Create" but consider keeping URL or adding `/create` redirect |

### 6.2 Proposed new routes (to add)

| New route | Purpose | Notes |
|-----------|---------|-------|
| `/create` | New creation entry point (replaces `/upload` as primary CTA) | Add redirect from `/upload` or keep both |
| `/library` | Keep as-is — "Everything you've created" | Rename UI copy only |
| `/create/[id]` or `/edit/[id]` | Draft editor (replaces `/repurpose/[id]`) | Add redirect from old route |

### 6.3 Domain

| Current | Decision |
|---------|----------|
| `repurpose.ai` (referenced in app/page.tsx:291) | Preserve until VervAI gets its own domain. Update when domain changes. |
| `repurpose-ai-swart.vercel.app` (production deploy) | Preserve until custom domain configured. |
| `support@repurpose-ai.app` | **REPLACE** with `support@vervai.com` (or actual support address). |

---

## 7. SEO Changes Needed

### 7.1 Page titles (HTML `<title>` tags)

| Page | Current title | New title |
|------|--------------|-----------|
| Homepage (`app/page.tsx` via `app/layout.tsx`) | `Repurpose AI — one recording, three posts` | `VervAI — turn your content into your next best content` |
| Privacy Policy | `Privacy Policy — Repurpose AI` | `Privacy Policy — VervAI` |
| Terms of Service | `Terms of Service — Repurpose AI` | `Terms of Service — VervAI` |
| Login page | (inherits layout title) | Update layout title; login page may need its own title |
| Branding page | (inherits layout title) | Update layout title |
| Dashboard / Library / Upload / Settings / Agent / Connections | (inherits layout title) | Consider per-page titles: `VervAI — Library`, `VervAI — Create`, etc. |

### 7.2 Meta description

- `app/page.tsx` marketing copy references "RepurposeAI" — update to "VervAI".
- Meta description (if any) should reflect VervAI positioning.

### 7.3 Open Graph / Social sharing

- Check `app/layout.tsx` or `app/page.tsx` for OG tags. Update any `og:title`, `og:description`, `og:site_name` that reference Repurpose.

### 7.4 Structured data

- If any JSON-LD structured data is added, update organization name to VervAI.

### 7.5 sitemap / robots.txt

- If `sitemap.xml` or `robots.txt` reference Repurpose, update.
- Vercel sitemap generation (if enabled) will pick up new titles automatically.

### 7.6 Redirect strategy for SEO

- Old URLs (`/repurpose/[id]`) should return **301 redirects** to new URLs to preserve SEO equity.
- Implement via Next.js `middleware.ts` or `next.config.js` redirects.
- Document the redirect map:

```
/repurpose/[id]    →  /create/[id]    (301)
/upload             →  /create         (301, once /create is ready)
```

---

## 8. Auth Branding Changes Needed

### 8.1 Current auth flow

- Email/password via Supabase Auth
- Login page: `app/login/page.tsx`
- Reset password: `app/reset-password/page.tsx`
- Auth callback: `/api/auth/callback`
- Middleware protects routes

### 8.2 Branding changes

| Item | Current | New | File |
|------|---------|-----|------|
| Login page title | (inherits "Repurpose AI — one recording, three posts") | "VervAI — turn your content into your next best content" | `app/layout.tsx` |
| Login page copy | "One recording, three posts" | VervAI promise | `app/login/page.tsx` |
| Auth callback redirect | Uses `?next=reset-password` allowlist | Unchanged | `app/login/page.tsx` + `middleware.ts` |
| Supabase auth UI (if any) | N/A | N/A | No branded auth UI detected |

### 8.3 Supabase project

- Supabase project is `repupose-ai-v4` (ref: `db.<ref>.supabase.co`). This is a backend project name, not user-facing. No change needed.
- Supabase publishable key env var: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — no brand reference. Unchanged.

---

## 9. Analytics Changes Needed

### 9.1 Current analytics event names

| Event name | Current prefix | Decision |
|------------|---------------|----------|
| `repurpose.rate_limited` | `repurpose.*` | **PRESERVE** — internal analytics. Changing breaks time-series. |
| `repurpose.enqueue_rpc_failed` | `repurpose.*` | **PRESERVE** |
| `repurpose.limit_reached` | `repurpose.*` | **PRESERVE** |
| `repurpose.enqueue_rpc_no_job` | `repurpose.*` | **PRESERVE** |
| `repurpose.idempotent_replay` | `repurpose.*` | **PRESERVE** |
| `repurpose.enqueued` | `repurpose.*` | **PRESERVE** |
| `repurpose_job` (feature flag) | `repurpose_job` | **PRESERVE** |

### 9.2 Analytics taxonomy decision

**Option A — Keep `repurpose.*` events forever**:
- Pros: Zero analytics disruption. Historical data stays continuous.
- Cons: Event names reference old brand. New events for VervAI features would need a different prefix.

**Option B — Introduce `vervai.*` events alongside, migrate over time**:
- Pros: Clean brand alignment.
- Cons: Dual event namespaces create confusion. Historical data split.

**Recommendation**: **Option A**. Keep `repurpose.*` events as internal event names. They are implementation-level events, not user-facing. If new VervAI-specific analytics events are needed (e.g., `vervai.voice_setup_completed`), add them with a `vervai.` prefix. Document the split in the analytics taxonomy.

### 9.3 User-agent header

- `lib/ingestion/url-fetch.ts:58`: `"user-agent": "RepurposeAI-ingestion/1.0"` → `"VervAI-ingestion/1.0"`. This IS user-facing (third-party servers see it). Update.

---

## 10. VervAI Positioning and Product Promise

### 10.1 Product name

**VervAI** (pronounced "verv-ay" or "verv-AI" — confirm with team).

### 10.2 Product promise

> **"Turn your content into your next best content."**

This is the core value proposition. It replaces "one recording, three posts."

### 10.3 What VervAI does

VervAI transforms a single piece of content (audio recording, video, YouTube link, transcript) into multiple ready-to-publish drafts across formats (LinkedIn post, newsletter, short-form script). It learns your brand voice and applies it consistently.

### 10.4 The Agent is a capability, NOT the product

The Agent (with its six intents: Create, Plan, Repurpose, Improve, Find opportunities, Build a week) is a feature inside VervAI. It is NOT called "VervAI Agent" in UI. It is "the Agent" or "VervAI's Agent" internally, but in user-facing UI it appears as intent chips and run controls — never as a product name.

### 10.5 Voice and tone

- **Confident but not hype-y**: VervAI does the writing; you stay in control.
- **Creator-first**: Built for people who create, not for content mills.
- **Voice-preserving**: The brand voice feature is core — "Teach VervAI how you sound."

### 10.6 Tagline usage

| Context | Tagline |
|---------|---------|
| Homepage H1 / hero | "Turn your content into your next best content." |
| Short version (nav, footer) | "VervAI" (wordmark only) |
| Social / share | "Turn your content into your next best content." |
| App shell title | "VervAI" |

### 10.7 What changes in the UX

| Current | New |
|---------|-----|
| "Repurpose content" (primary CTA) | "Create content" |
| "Repurpose a recording" (menu) | "Create content" |
| "RepurposeAI" (product name in copy) | "VervAI" |
| "Repurpose AI" (legal titles) | "VervAI" |
| "one recording, three posts" (tagline) | "Turn your content into your next best content." |
| "Repurpose" wordmark | "VervAI" wordmark |
| "repurpose jobs" (usage language) | "creation jobs" or "VervAI jobs" |
| "Repurpose something" (empty states) | "Create something" |

---

## 11. Migration Order (Recommended)

### Phase 1: Brand strings (no behavior change)
1. `app/layout.tsx` — title, OG tags
2. `components/logo.tsx` — alt text, wordmark
3. `components/app-shell.tsx` — wordmark in top bar
4. `components/footer.tsx` — nav label, copyright
5. `components/create-menu.tsx` — menu title
6. `app/page.tsx` — all marketing copy
7. `app/login/page.tsx` — login copy
8. `app/legal/privacy/page.tsx` — title
9. `app/legal/terms/page.tsx` — title + body
10. `app/(app)/dashboard/page.tsx` — usage strip copy
11. `app/(app)/library/page.tsx` — page heading, CTA
12. `app/(app)/library/source-list.tsx` — hero text, button
13. `app/(app)/upload/page.tsx` — hero text, toast, YouTube connect copy
14. `app/(app)/settings/usage/page.tsx` — usage page copy
15. `app/(app)/connections/page.tsx` — connections description
16. `components/branding-form.tsx` — branding form copy
17. `components/output-editor.tsx` — editor footer
18. `components/usage-meter.tsx` — usage meter (delegate to lib/billing)
19. `components/agent/opportunity-feed.tsx` — empty state
20. `components/agent/outcome-composer.tsx` — empty state
21. `components/dashboard/objective-prompt.tsx` — dashboard card
22. `components/dashboard/opportunity-next.tsx` — dashboard button
23. `components/connections-youtube.tsx` — YouTube connect copy
24. `lib/billing/plans.ts` — plan feature strings
25. `lib/billing/usage.ts` — usage limit message
26. `lib/ai/openrouter.ts` — X-Title header
27. `lib/ingestion/url-fetch.ts` — user-agent header
28. `app/api/prompts/analyze-voice/route.ts` — system instruction

### Phase 2: API and backend (preserve identifiers, update user-facing messages)
29. `lib/ingestion/normalize.ts` — error message
30. `lib/ingestion/providers/ytdlp.ts` — error message
31. `app/api/agent/strategy/next/route.ts` — API response body
32. `lib/agent/strategy.ts` — strategy detail message

### Phase 3: Docs (update all documentation)
33. `README.md`
34. `docs/AGENTIC_ROADMAP.md`
35. `docs/IMPLEMENTATION_MAP.md`
36. `docs/ROADMAP.md`
37. `docs/UX_AUDIT.md`
38. `docs/production-audit.md`
39. `docs/agentic-v2-audit.md`
40. `docs/legal-review.md`
41. `docs/data-model.md`

### Phase 4: URL redirects (when new routes are ready)
42. Add `/create` route
43. Add `/create/[id]` route
44. Add redirects from `/repurpose/[id]` → `/create/[id]`
45. Add redirect from `/upload` → `/create` (optional, once `/create` is primary)
46. Update `middleware.ts` protected paths if new routes added

### Phase 5: Domain and email (when ready)
47. Configure `vervai.com` (or chosen domain) and add to Vercel
48. Replace `support@repurpose-ai.app` with `support@vervai.com` everywhere
49. Update `app/page.tsx:291` domain reference when live

### Phase 6: Analytics (optional, separate decision)
50. Decide on `repurpose.*` vs `vervai.*` event naming
51. Document analytics taxonomy

---

## 12. Files NOT requiring changes

The following were checked and require **no brand changes**:

- `app/(app)/repurpose/[id]/page.tsx` — route page. File path preserved. Generic verb only.
- `app/(app)/content/calendar/page.tsx` — no brand strings.
- `app/(app)/publish/page.tsx` — no brand strings.
- `types/agent.ts` — type definitions. Intent names preserved.
- `lib/output-registry/` — output format definitions. No brand strings.
- `lib/intelligence/types.ts` — type definitions.
- `lib/ai/prompts.ts` — façade over output-registry. No brand strings.
- `lib/output-registry/definitions.ts` — format definitions.
- `components/agent/run-detail.tsx` — references `/repurpose/${o.id}` URL (preserved). No brand strings beyond URL.
- `app/api/integrations/youtube/videos/route.ts` — comment only.
- `app/api/repurpose/route.ts` — all brand strings are code identifiers or event names (preserved).
- `supabase/schema.sql`, `supabase/migrations/*.sql` — internal comments only.
- `.env.example`, `.env.local` — env var names only (preserved).

---

## 13. Open Questions

1. **Agent intent chip "Repurpose"**: Should it stay as "Repurpose" (accurate capability description) or change to "Remix" / "Reconstruct" to avoid brand confusion? This is a UX decision, not a brand migration requirement. Recommend discussing with UX team.

2. **VervAI pronunciation**: Confirm with team. "verv-ay"? "verv-AI"? This affects audio branding, voice prompts, and support scripts.

3. **Domain**: What is the actual VervAI domain? `vervai.com`? `verv.ai`? Confirm before updating domain references.

4. **Support email**: What is the actual support address? `support@vervai.com`? Confirm before updating.

5. **Vercel project**: When to create a new Vercel project named `vervai` and migrate deployment? Depends on domain and timing.

6. **Redirect strategy**: Should `/repurpose/[id]` redirect to `/create/[id]` or to `/library` (if the editor is library-centric)? Depends on final URL structure decision.

7. **Usage language**: "creation jobs" vs "VervAI jobs" vs "generations" — which term is the canonical usage unit name? Recommend deciding with product team.

---

*End of audit. This document is the source of truth for all VervAI brand migration work. Update it as decisions are made.*
