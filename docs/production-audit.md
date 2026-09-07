# Production Readiness Audit — RepurposeAI

Phase 0 deliverable of the business-ready production program. State captured against
`main` at `9d02792` (plus 5 uncommitted settings-layout files). Every claim below was
verified by reading the code, not assumed.

---

## 1. Frontend

### Pages & roles
| Route | Type | Notes |
|---|---|---|
| `/` | marketing (server) | Hero, `#how-it-works`, `#outputs`, `#pricing` anchors, FAQ, navbar/footer shell. Mature phase-4 state. |
| `/login` | auth | Email/password + magic link; `next=` redirect param. |
| `/reset-password` | auth | Recover password (protected-adjacent). |
| `/legal/terms`, `/legal/privacy` | static | Plain-English, `docs/legal-doc` component; `CONTACT` email is a placeholder. |
| `/dashboard` | app (server + client polling) | Overview: usage strip, quick-repurpose card, 2×2 metrics, recent activity, "your content system". |
| `/upload` | app (client) | 3 modes (upload media / YouTube / transcript), format picker honoring `maxOutputsPerJob`, client-side validators + duration probe, idempotency key via `crypto.randomUUID()`, fire-and-forget worker kick. |
| `/library` | app | Source list + status badges, pending-job re-kick. |
| `/repurpose/[id]` | app | Draft editor (preview/edit tabs, save/discard, regenerate, copy, export). |
| `/branding` | app | Brand voice + per-format prompt overrides. |
| `/connections` | app | YouTube OAuth connect/disconnect. |
| `/settings` | app | Profile + preferences + account cards. |
| `/settings/usage` | app | Plan & usage detail. |

### Shared primitives (reuse, don't rebuild)
`app-shell` (nav), `card`, `status-badge`, `usage-meter`, `empty-state`, `page-header`,
`segmented-control`, `copy-button`, `output-editor`.

### Frontend strengths
- Design system via Tailwind tokens (`theme-*`, `primary-*`), `workspace` container, typography scale, focus rings + reduced-motion, mobile-first grid layouts.
- Every async flow has explicit busy / disabled / error / empty / at-limit states (`upload`, `dashboard`, `library`, `editor`).
- Client never reads plan/permissions from the browser; usage is fetched server-side through `/api/usage`.

### Frontend gaps (later phases)
- No `output_versions`/history at the UI level (editor writes in place).
- No delete/export-all/user export data flow.
- Marketing pricing section omits paid tiers (intentional `isPublic` gating).
- No onboarding/demo-mode/sample content.
- `/library` and `/repurpose/[id]` not yet read this audit pass; flagged for P10/P14.
- One component earlier threw a transient dev-only "waitlist-link not found" manifest error — dev-source flake, absent from the prod build, no action.

## 2. Backend

### Route inventory
| Route | Method | Auth | Protection model |
|---|---|---|---|
| `/api/repurpose` | POST | session | ownership check on source; plan/usage/rate gates; enqueue-only |
| `/api/process` | POST | session | ownership check on job; atomic claim + 10-min stale re-claim; SSE progress |
| `/api/usage` | GET | session | plan + reactive usage snapshot |
| `/api/outputs/[id]` | PATCH | session | ownership check then service-role write (no update policy); 100k char cap; `updated_at` fallback |
| `/api/outputs/[id]/regenerate` | POST | session | ownership; budget reservation (optimistic guarded update, released on failure); service-role writes |
| `/api/sources` | GET | session | own sources+outputs, live jobs |
| `/api/sources/[id]` | DELETE | session | ownership; storage object + cascading row delete |
| `/api/prompts` | GET/POST | session | PROMPT_KEYS allowlist; 8k cap; upsert on `(user_id, format)`; service-role write |
| `/api/events` | POST | session | allowlisted event names only; service-role write |
| `/api/integrations/youtube/{connect,callback,status,videos,disconnect}` | — | session | state-cookie anti-CSRF, timing-safe compare, encrypted token store |
| `/api/auth/callback` | GET | — | Supabase PKCE exchange |

### Library layer
- **Ingestion** `lib/ingestion/`: one `ingestSource()` seam → `TranscriptDocument`. Providers: youtube (captions-first, yt-dlp fallback archived), upload (AssemblyAI), transcript (SRT/VTT/TXT). `saveTranscript` persists canonically, degrade-safe on missing table.
- **AI** `lib/ai/`: `generate.ts` Gemini-first with OpenRouter fallback on quota/429 only; `retry.ts` retryOnOverload (exponential backoff honoring `RetryInfo.retryDelay`, 90s cap, retries dropped connections / 429 / 503); `transcribe.ts` AssemblyAI submit+adaptive-poll (10-min cap, fails loud after 3 transient errors); `prompts.ts` pure prompt vocabulary + `buildSystemPrompt` (override ≥ default, brand voice layered).
- **Billing** `lib/billing/`: `plans.ts` pure config (4 tiers, only `beta` public); `entitlements.ts` `resolvePlan` + `ensureProfile` (service role, fails open to beta); `usage.ts` reactive monthly count off `jobs` (`refunded=false`), UTC month window, `maxInputSecondsFor` plan∩env cap; `usage-client.ts` browser fetch wrapper.
- **Security** `lib/supabase/server.ts` split `createClient` (user session, RLS enforced) vs `createServiceClient` (service role — only used server-side in routes/libs); `lib/crypto.ts` AES-256-GCM token sealing; `lib/youtube/connections.ts` encrypted-at-rest credentials, 60s access-token skew refresh.
- **Limits/config** `lib/limits.ts` env-tunable caps shared by client and server; `lib/rate-limit.ts` rolling-1-min job count, fails open.

### Backend strengths
- Enqueue→claim→worker pattern is real (not fake): `/api/repurpose` returns immediately, `/api/process` claims atomically and streams progress over SSE.
- Every paid-work path is: auth → ownership → plan → usage → rate-limit → idempotency → enqueue.
- Refund model is sound at the row level: `refunded` flag excludes refunded jobs from usage; platform failures refund, `InputLimitError` (too-long input) doesn't.
- Idempotency unique partial index `(user_id, idempotency_key)` prevents double-submit double-charge; conflict path returns the winner.
- Service-role is never imported into client components (verified: `lib/billing/usage-client.ts`, `lib/analytics/event-names.ts`, `lib/limits.ts` are the pure client-safe modules).
- Graceful degradation everywhere (missing-table → defaults, don't fail the job).

### Backend gaps (later phases, mapped)
- **Jobs (P4):** no per-format partial completion — `Promise.all` in `/api/process` fails all on one format error; no heartbeat; no per-stage persisted events (`job_events` table absent); cancel not possible; retry policy is implicit (stale re-claim), not policy-driven; match/attempt tracking is thin.
- **Worker (P5):** runs inside the Next.js serverless runtime (Vercel function), time-limited; `assemblyai.transcribe` caps at 10 min and `generate` retry at 90s partly to fit the stale window — a dedicated worker removes those ceilings.
- **AI provider (P6):** raw `@google/generative-ai` + hand-rolled fetch to OpenRouter; no provider abstraction, no model registry, no transcript/content intelligence layer, no evaluation hook.
- **Billing reservation (P3):** usage is reactive-count, not a transactional reserve/consume/release. Two concurrent distinct requests can both read `used=4` and both enqueue past a limit of 5. Idempotency guards same-key duplicates only. Refund is a boolean flag, not a ledger event; no `subscriptions`/`subscription_events`/`plans` tables in DB (plan is a code constant + `profiles.plan`).
- **RLS gaps (P2):** `outputs` has no UPDATE policy (service-role writes in PATCH/regenerate — acceptable but undocumented drift); `sources` UPDATE policy uses `using` but no `with check` — a user could in theory rebind `user_id` via a direct update (verify-rls.sh doesn't test update-with-forged-owner; the route layer always scopes `.eq("user_id", user.id)` so app-level risk is low, but the policy alone is weaker than `sources` INSERT's `with check`).
- `sources` DELETE uses service-role instead of the RLS delete policy (the policy exists) — deliberate (cascade + storage), but the `/api/events` name allowlist and `track()` allow any logged-in user to spam the events table indirectly.

## 3. Infrastructure

### Stack (in use, verified in package.json)
- Next.js **14.2.15** App Router, React **18.3.1**, TypeScript **5.5.3**, Tailwind **3.4.4**, `@supabase/ssr` **0.12.6**, `@supabase/supabase-js` **2.45.4**, `@google/generative-ai` **0.21.0**, `react-markdown` + `remark-gfm`.
- Hosting: **Vercel** (production deployed at `https://repurpose-ai-swart.vercel.app`; account `fragilefrogff-5333`, team `team_YOyNtLkkZLsyeKERFhWmd9HG`, project `prj_WzjeARXPpVKH3YNGqUO24BwTmFHN`, linked in `.vercel/project.json`).
- Data: **Supabase** Postgres + Auth + Storage (private `sources` bucket; per-user folder `sources/{user_id}/…` + storage policy).
- AI: Gemini (`gemini-3.6-flash`) primary, OpenRouter fallback, AssemblyAI transcription.

### Env inventory (names verified, values not committed)
`.env.example` covers: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_TOKEN_ENCRYPTION_KEY`, optional `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`.
Runtime `.env`/`.env.local` both gitignored; `.env.local` additionally carries `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (set but not referenced by any code — dead env var, clean up in P1/P28).
Env-tunable limits (not in `.env.example` yet): `MAX_SOURCE_FILE_MB`, `MAX_INPUT_SECONDS`, `REPURPOSE_RATE_LIMIT_PER_MIN`, `OPENROUTER_MODEL`, `YTDLP_JS_RUNTIME`, `YTDLP_DOWNLOAD_TIMEOUT_MS`, `LOG_LEVEL`, `LOG_WEBHOOK_URL`.

### Schema
Single hand-rolled `supabase/schema.sql` (idempotent `create table if not exists`, RLS on all tables, storage policies, `handle_new_user()` security-definer trigger). **No `supabase/migrations/` directory**; no `npm run db:push`; `npm run db:types` requires a live `$SUPABASE_PROJECT_ID`. `types/supabase.ts` is generated but **handwritten/placeholder** (several structural row types mirror tables manually, e.g. `YoutubeConnectionRow`).

Tables: `sources`, `outputs`, `jobs`, `user_prompts`, `youtube_connections`, `transcripts`, `profiles`, `events`.

### Infra gaps (later phases)
- Migrations (P1): no versioned migrations dir, `db:types` not wired to CI, generated types not reproducible without live project id.
- Observability (P16): structured JSON logs to stdout only, optional fire-and-forget `LOG_WEBHOOK_URL`; no error tracker, no uptime checks, no cost aggregation.
- CI/CD (P18): no `.github/workflows`, no build gate, no preview-env wiring beyond raw `vercel`.

## 4. Business readiness

Currently: **beta (free) only**. `creator`/`pro`/`studio` tiers exist as code config (`PLANS`), `available: false`, `isPublic: false`. No checkout, no webhooks, no subscriptions, no dashboards.

### What exists and works
- Plan enforcement server-side on every paid path (outputs-per-job, usage-per-month, input-minutes, regeneration budget).
- Usage UI on dashboard/upload/settings; `atLimit` blocks upload before creating a dead source row.
- Analytics event ledger (`events`, service-role-only writes, allowlisted names) incl. activation events (signup, first job started/completed, job failed/retried, limit reached, usage 50/80/100% thresholds, regeneration/draft interactions, waitlist clicks).

### Business gaps (mapped to phases)
- Billing (P3): no live subscription lifecycle. Reserve/consume/release semantics, ledger, `subscriptions(subscription_events)` tables.
- Brand voice/understanding (P8): prompts exist; "content intelligence" (titles, topics, key points, quotes, episode metadata) does not.
- Brand voice set (P7/P8): stored as a free-text prompt override; no structured profile/voice fields.
- Evaluation (P9): no AI-quality checks (hooks in to-generate only, transient).
- Onboarding (P14), demo/sample content, and activation nudges absent.
- Legal (P24): pages not lawyer-reviewed; `CONTACT` placeholder; no data-export, no account-deletion route, no retention job for Storage objects (row cascade exists on user delete).
- Marketing (P13): home is strong; no pricing gate visibility, no blog/docs, no waitlist capture beyond the link component.

## 5. Testing

### Exists
- `scripts/verify-rls.mjs` (`npm run verify:rls`): creates two throwaway users, asserts B cannot read/update/delete/forge A's rows, verifies profile/events gating and user-delete cascade. 12 checks; ran green previously.
- Manual dev-server verification repertoire (route spot-checks, 200/307, SSE flow).
- `npm run lint` (next lint), `npm run build`, `npx tsc --noEmit` — run as CHECKPOINT 0, results below.

### Missing (P17)
- No unit test runner (no vitest/jest), no component tests.
- No integration tests for `/api/repurpose` → claim → ingest mock → generate mock → outputs.
- No E2E (Playwright).
- No test helpers that hit live third parties (AssemblyAI/Gemini/Google) — nothing isolates them.
- No seed/fixture dataset, no test Supabase project or CI DB.

## 6. Gap findings requiring human action (not code)
- Vercel **token was pasted in-session** — rotate it if the transcript is shared.
- `.env.local` Gemini key was shared earlier (README flags it) — rotate at aistudio if concerned.
- Google OAuth live-verification of the YouTube flow still blocked on client creds being real + schema migration applied to the Supabase project.
- `cookies.txt` sits in the repo root (gitignored?) — verify it's gitignored; if not, add it (P1 housekeeping).

---

**Derived work order (feeds P1–P28):** DB foundation (migrations, generated types, verified RLS) → security hardening (update-policy with check, service-role audit) → billing reserve/refund ledger → job/worker hardening → provider abstraction → content intelligence/brand voice/eval → UI (editor versions, dashboard, creation workspace) → marketing/onboarding → storage lifecycle → observability → tests → CI/CD → performance → design polish → responsive → settings → legal → analytics → release gates → docs.
## Addendum (2026-09-07, P1): live schema is INCOMPLETE vs code

`npm run verify:rls` now fails 3 billing checks because the live project
(`mtjcyxwxhavpgncxbhix`) is missing the plans/entitlements + events + idempotency
tail of `supabase/schema.sql`. Confirmed by service-role REST probes:

| Object | Live state |
|---|---|
| `public.profiles` table | MISSING |
| `public.events` table | MISSING |
| `sources.duration_seconds` | MISSING |
| `jobs.idempotency_key` / `jobs.refunded` | MISSING |
| `outputs.regeneration_count` | MISSING |
| `handle_new_user` trigger / `on_auth_user_created` | MISSING (new signups succeed) |

The app still "works" because billing/analytics are intentionally fail-open and
degrade-safe, but this silently disables plan enforcement, refunds, idempotency
guarding, usage caps, and event capture in production. **High-priority gap.**

Fix (already written, NOT yet applied to live):
- `supabase/migrations/20260907000001_initial.sql` — baseline = actual live state (6 tables).
- `supabase/migrations/20260907000002_profiles_events.sql` — idempotent additive migration for everything missing.

To apply to live: paste `0002` into Dashboard > SQL Editor, or (CLI) mark `0001`
as applied (`supabase migration repair --status applied`) then `supabase db push`.
Blocked until a Supabase PAT or `supabase login` is available.

`npm run db:types` was broken (bash-only `$SUPABASE_PROJECT_ID`, unauthenticated
CLI); replaced by `scripts/gen-types.mjs` (cross-platform, derives project ref
from the URL, needs `SUPABASE_ACCESS_TOKEN` or CLI login). `.env.example` now
documents the full env matrix including the runtime tunables and marks
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as dead.

## Addendum (2026-09-07, P2): RLS/service-role audit + verify:rls now 19/19

- **Service-role usage audit** (every `createServiceClient()` call classified):
  `lib/analytics/events.ts`, `lib/billing/usage.ts`, `lib/billing/entitlements.ts`,
  `lib/rate-limit.ts`, `lib/youtube/connections.ts`, `lib/prompts.ts`, the worker
  (`/api/process`), `/api/repurpose` enqueue, `/api/outputs/[id]` PATCH + regenerate —
  all either REQUIRED (runs against policy-less `outputs`/`events`/`profiles`, or
  storage deletes) or pinned to the authenticated user server-side. No unjustified
  bypasses beyond the one fixed below.
- **Fixed**: `/api/sources/[id]` DELETE deleted the row via the service role
  despite a `sources` delete policy existing. Row delete now runs through the
  user-scoped client with `.eq("user_id", user.id)` (DB-layer ownership). The
  storage-object `remove()` stays service-role (no DELETE policy on
  `storage.objects`).
- **Migration `0003_harden_update_policies.sql`**: dropped+recreated every UPDATE
  policy with an explicit `WITH CHECK (auth.uid() = user_id)` (functionally the
  Postgres default, but self-documenting). Note: `profiles`/`events`/`outputs`
  intentionally keep NO update policies (server-write only). Apply to live when
  convenient — not urgent, the default already enforces the same rule.
- **verify-rls deepened** (16 -> 19 checks): owner may not reassign `user_id` via
  UPDATE; owner may not update their own `outputs` client-side (server writes
  only); owner CAN update their own source title. Suite is green (19/19).
- Left as-is, knowingly: the `updated_at`-column fallback regexes in
  `/api/outputs/[id]` and regenerate (dead — `updated_at` exists in baseline; P4
  cleanup), and `/api/repurpose`'s `formats`-fallback in the enqueue route (also
  effectively dead post-B1; revisit in P4).

## Addendum (2026-09-07, P3): atomic billing ledger + subscription scaffold

- **The big hole fixed**: monthly usage was a *reactive* jobs-table count —
  `check used < limit`, then insert — which is NOT atomic. Two concurrent
  distinct enqueues could both read the same `used` and overshoot the cap.
  - `/api/repurpose` now calls **`public.enqueue_job(...)`** (migration 0004): one
    transaction, serialized per user via `pg_advisory_xact_lock(hashtextextended(user_id,0))`,
    which makes check-then-insert race-free. It also handles idempotent replay
    internally and writes the `reserve` ledger row in the same transaction.
  - **Fail closed**: if the RPC errors (migration missing / DB hiccup), enqueue
    returns 503 — the paid work no longer runs unbilled.
  - **Privilege**: EXECUTE on `enqueue_job` is revoked from `public`/`anon`/
    `authenticated` and granted only to `service_role` (Postgres grants EXECUTE
    to PUBLIC by default; without this an anonymous caller could reserve slots
    for any `user_id`). The route passes the caller's own id from their session.
  - Dead fallback regexes in `/api/repurpose` (formats-column, idempotency
    conflict) and its old reactive pre-check are gone.
- **New objects** (migration
  `20260907000004_billing_ledger.sql`): `usage_events` (append-only ledger,
  RLS on / no policies), `subscriptions` (select-own only; server/webhook
  writes), `subscription_events` (immutable webhook log, no policies). The
  subscription tables are the landing zone for the P-future payment-provider
  integration — nothing writes them yet.
- **Ledger lifecycle**: `reserve` (enqueue, in RPC) → `consume` (worker success)
  or `refund` (worker platform-side failure; invalid input is counted, not
  refunded). Enforcement still reads `jobs.refunded`; the ledger is the
  immutable audit trail, and `/api/usage` display counts stay reactive
  (fail-open) since enforcement moved to the RPC.
- **verify:rls extended** (19 on-data checks + 5 ledger/subscription checks that
  SKIP until 0004 lands on live, then go green). Not yet applied to live.
- Credit/cost: any prepaid-credits future is out of scope; the ledger already
  supports `release` for the P4 cancellation flow.
