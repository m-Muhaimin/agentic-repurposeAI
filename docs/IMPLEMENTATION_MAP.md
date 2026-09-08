# Implementation Map — RepurposeAI (agentic-v4)

Phase 0 repository audit. Ground truth for Phase 1 (canonical source architecture).
Companion to `docs/agentic-v2-audit.md` (the as-found baseline) and
`docs/data-model.md` (table-level detail). Stack: Next.js 14.2.15 (App Router) +
Supabase (Postgres / Auth / Storage) + Gemini (`gemini-3.6-flash`) with an
OpenRouter fallback + AssemblyAI transcription.

> Truth check before reading: `docs/agentic-v2-audit.md` is **stale** (claims
> Next.js 15; `package.json` has `next 14.2.15`; claims the distribution tool is
> a throwing stub — it is now a real Buffer publish path). `docs/data-model.md`
> predates `buffer_connections` + migration 0005 practice. Treat this map as the
> current source of truth.

---

## 1. Source flow — how content enters the system

### Canonical ingestion contract
`lib/ingestion/` is the single seam. Every input mechanism resolves down to one
`TranscriptDocument`:

- `types.ts` — `IngestionSourceType = "youtube" | "audio" | "video" | "transcript"`;
  `IngestSource` (the structural slice of a `sources` row providers need);
  `TranscriptDocument { text, segments?, language?, durationSeconds?,
  provider?, providerTranscriptId?, source: {type, url?, title?, author?,
  authorId?} }`; `TranscriptSegment { startMs, endMs, text, speaker? }`;
  `IngestionContext { service, onProgress? }` (service-role client + progress
  callback for the dashboard SSE).
- `index.ts` — `ingestSource(source, ctx)`: switches on `source_type` →
  `ingestYouTube` / `ingestUploadedMedia` / `ingestTranscript`. This switch IS
  the current (implicit) source registry.
- `save.ts` — `saveTranscript()` upserts onto `transcripts` (unique `source_id`),
  provider ∈ `assemblyai | youtube_captions | transcript_file`; degrades
  gracefully when the table is missing (regex on the error) so the denormalised
  `sources.transcript` still gets written.

### The three providers (all behind the same seam)
- **Uploaded media** → `lib/ingestion/upload.ts`: size gate (200 MB default,
  env-overridable) + extension allowlist (`lib/limits.ts`) + MIME check on the
  stored object's metadata → signed URL → AssemblyAI (`lib/ai/transcribe.ts`).
- **YouTube** → `lib/ingestion/youtube.ts`: preferred path is **OAuth captions**
  (YouTube Data API — no download, no AssemblyAI); falls back to the **legacy
  yt-dlp path** (`providers/ytdlp.ts`: probe → duration gate → download mp3 →
  storage → AssemblyAI), which is archived as the fallback (the cookie-sync
  extension is retired). `describeYoutubeError` maps raw yt-dlp noise to
  user-facing messages. Videos come in as a URL (`sources.source_url`), the
  pulled mp3 lands in storage as a side effect.
- **Transcript file** → `lib/ingestion/transcript.ts`: `.txt` / `.srt` / `.vtt`,
  with `looksLikeSubtitles` recovering a wrongly-extended `.txt`. Subtitle files
  produce segments with timestamps; plain `.txt` is one block.

### Request path
1. Client (`app/upload/page.tsx`, modes file / youtube / transcript) uploads the
   file to the private `sources` bucket under `sources/{user_id}/{filename}` and
   inserts a `sources` row (`status='uploaded'`).
2. `POST /api/repurpose` enqueues a `jobs` row — ownership check, format
   whitelist (`isOutputFormat`), rate limit, idempotency key, and the atomic
   `enqueue_job` RPC (advisory lock per user; `reserve` ledger event).
3. `POST /api/process` (SSE worker) claims a queued job (10-min stale window),
   calls `ingestSource()` → `saveTranscript()`, transitions
   `sources.status`: `transcribing → done/failed`, then runs generation for the
   job's formats.

### Lifecycle vocabulary
- `sources.status`: `uploaded → transcribing → transcribed → generating → done`,
  or `failed` (enum in migration 0001 / `types/supabase.ts`).
- `jobs.status`: `queued → running → done`, or `failed`; `attempt` / `refunded`
  columns. `jobs` is the durable queue; `sources.status` is the user-facing
  progress.
- `transcripts.status`: `processing | ready | failed`.

---

## 2. Output flow — generation

- Formats are fixed at `linkedin_post | newsletter | shortform_script`
  (`lib/billing/plans.ts` `OUTPUT_FORMATS`, mirrored in `types/agent.ts`).
- Generation lives in `lib/ai/generate.ts` (Gemini `gemini-3.6-flash`, Google
  `RetryInfo`-aware backoff via `lib/ai/retry.ts`, OpenRouter quota fallback).
- The worker writes one `outputs` row per format, per source. The agent's
  `generation` tool reuses the **same `outputs` table**, so agent drafts appear
  in `/library` and the `/repurpose/[id]` editor with zero new viewer code.
- `outputs` has **no UPDATE policy** — all edits go through
  `PATCH /api/outputs/[id]` (service role) so regeneration budgets
  (`regeneration_count`) and the P4 edit-signal capture apply.
- User prompts + brand voice: `user_prompts` rows (one per format + a
  `brand_voice` row), edited on `/branding`; layered into prompts server-side in
  `lib/ai/prompts.ts`.
- Evaluation is deterministic (no LLM judge): `lib/agent/evaluator.ts` weights
  length 0.4 / format-shape 0.3 / grounding 0.3; grounding is a cheap
  verbatim-overlap check against the transcript; weak drafts get flagged and, in
  execute/automate, exactly **one** bounded revision (`revisionInstruction`).

---

## 3. Agent flow — the agentic layer

### Orchestrator (durable, the only loop)
`lib/agent/orchestrator.ts` behind `POST /api/agent/process` (SSE, mirrors the
base worker):
- Claim/resume model; planning stale after 10 min, execution re-clains after a
  90 s heartbeat gap (`heartbeat_at`); retries classified
  (`lib/agent/errors.ts`, `MAX_PHASE_ATTEMPTS`, transient vs permanent).
- State machine: `created → planning → awaiting_approval → executing →
  evaluating → done`, with `failed | cancelled`.
- Every transition appends a `v4_agent_steps` row (append-only audit log).
- Per-run budgets snapshotted at creation (`v4_agent_runs.max_steps/
  max_cost_units/max_runtime_s` from the plan via
  `lib/agent/budgets.ts.budgetViolation`), enforced pre-call — budgets are
  server-side only, never client-supplied. `finalizeRun()` keeps completed
  drafts on any partial completion.

### Tool registry + permissions
`lib/agent/tools/registry.ts` declares 7 tools: `source`, `intelligence`,
`memory`, `generation`, `review`, `distribution`, `strategy`.
`lib/agent/permissions.ts` is the single capability truth:
- `assist`: plan/generate/review/evaluate — no revise, no distribute, no
  strategy writes.
- `execute`: + one bounded auto-revision.
- `automate`: reserved; `distribute`/`strategize` are surfaced as structured
  capability stubs today.
`DEFAULT_MODE` is exported from permissions; the runs POST route defaults to it.

### Human gate (P0 headline, must not regress)
- Plan approval: planner writes `v4_content_ideas` (3–7 angles with verbatim
  quotes + rationale), the run parks at `awaiting_approval`,
  `POST /api/agent/runs/[id]/approve` keeps/rejects per angle; reject-all →
  cancelled. `recordAngleDecision` persists keep/reject in memory.
- Every angle carries an objective score (`lib/agent/idea-scoring.ts`:
  grounding 0.4 / distinctness 0.3 / specificity 0.3) persisted on
  `v4_content_ideas.evaluation`; plan-view renders the score + weakness as
  opportunity tags (`lib/agent/plan-presentation.ts`) so the user sees *why*
  before deciding.

### Memory
`lib/agent/memory.ts` — explicit, user-editable brand voice
(`v4_agent_preferences`); edit signals are append-only + capped (~12), never
profile rewrites; confidence-gated confirm loop
(`suggestFromSignals` ≥ 0.6 confidence). `recordEditSignal` fires from the
editor save path via `lib/agent/edit-diff.ts`, but only for outputs that belong
to an agent run (`v4_agent_runs.output_ids @> [id]`).

### Strategy / opportunity engine
`lib/agent/strategy.ts` — **pure** `buildCandidates` (no I/O): sources w/ ready
transcript + monthly budget headroom only; score from P3 ideas (neutral 0.5
baseline), rejected-angle penalty (0.35), fresh-source boost (0.05),
under-produced-format bonus (0.08). `POST /api/agent/strategy/next` adds ONE
advisory LLM rationale call that can never override the deterministic ranking,
then persists an append-only `v4_content_strategies` snapshot (`source='planner'`).
Output is hand-shaped to the runs POST contract (`sourceId` + `mode`) so the
opportunity feed drops straight into the orchestrator.

### Distribution (real BYOB publish)
`lib/agent/tools/distribution.ts` is real: reads the approved draft from
`outputs`, resolves profiles (Buffer), calls Buffer's create-update API, flips
`v4_distribution_jobs` to `published`/`failed` truthfully. Human-gated:
`publishingChannelsConnected()` is the honest async gate (`buffer_connections`);
`nextPublishStatus` (lib/agent/publish.ts) makes `published` structurally
unreachable while no channel is connected; the send trigger is always a
user-click (`POST /api/agent/queue/publish`), never automatic.

### Honest-empty-state discipline (P11–P13)
Observe (`lib/agent/observe.ts`), retention windows (`lib/agent/retention.ts`,
90 days / 200 runs / 500 steps / 100 queue items), scale (`lib/agent/scale.ts`)
all derive only from real server rows and explicitly claim
`publishingConnected: false` / `engagementAvailable: false` — no fabricated
analytics, no autopilot door.

---

## 4. Database model

Ground truth lives in `supabase/migrations/` (apply order = filename order;
the hand-rolled `schema.sql` / `schema_agentic.sql` are the older sources these
converge). RLS grammar everywhere: `auth.uid() = user_id`.

| Table | Purpose | Notable columns / constraints |
|---|---|---|
| `sources` | one uploaded/URL source per row | `source_type` ∈ audio/video/youtube/transcript; `source_has_location` check; `status` enum; `transcript` denorm text; `duration_seconds` |
| `outputs` | generated drafts | `format` enum; **no UPDATE policy** (service-role writes only); `regeneration_count` |
| `jobs` | durable queue | `status` enum; `idempotency_key` unique per user (partial index); `refunded`; partial index on `(status, created_at)` |
| `transcripts` | canonical ingested transcript | **unique `source_id`**; `provider` ∈ assemblyai/youtube_captions/transcript_file |
| `user_prompts` | format overrides + brand voice | PK `(user_id, format)` |
| `profiles` | plan entitlement | `plan` ∈ beta/creator/pro/studio; auto-created by `handle_new_user()` trigger; read-only for clients |
| `events` | product analytics | RLS on, **no policies** (service-role only) |
| `usage_events` | reserve/consume/refund/release audit ledger | RLS on, **no policies**; written by `enqueue_job` |
| `subscriptions` / `subscription_events` | billing contract | service-role writes; user reads own row; unique user_id / provider_subscription_id |
| `youtube_connections` | OAuth link | tokens AES-GCM encrypted (`YOUTUBE_TOKEN_ENCRYPTION_KEY`); unique user_id |
| `buffer_connections` | Stage-4 BYOB | tokens AES-256-GCM (`BUFFER_TOKEN_ENCRYPTION_KEY`); unique user_id |
| `v4_agent_runs` | durable run | `mode`/`status` enums; `plan` jsonb; `transcript_snapshot`; token/cost counters; `output_ids`; P2 budget columns `max_steps(1-200)/max_cost_units(>0)/max_runtime_s(30-14400)` + `heartbeat_at` |
| `v4_agent_steps` | append-only step/audit log | `kind`/`status` enums; `input`/`output` jsonb; `retry_count` |
| `v4_content_ideas` | plan angles | `quotes` text[] (verbatim evidence); `evaluation` jsonb (P3 score); `approved` |
| `v4_agent_preferences` | brand voice + memory | `brand_tone`/`brand_forbidden_phrases`/`brand_examples`/`brand_samples`; `edit_signals` jsonb (capped ~12); `auto_mode` |
| `v4_distribution_jobs` | publish queue | `platform` enum (6); `status` draft/scheduled/published/failed/cancelled |
| `v4_content_strategies` | strategy docs | `source` ∈ heuristic/planner/manual |

Storage: bucket `sources`, private, folder-scoped `sources/{user_id}/…` (insert
+ select policies match `auth.uid() = foldername[1]`). All tables cascade from
`auth.users` (delete-user cleanup).

Migrations: 0001 initial, 0002 profiles/events/idempotency/trigger, 0003 UPDATE
policy WITH CHECK hardening, 0004 billing ledger + `enqueue_job` RPC, 0005 agentic
V4 tables, 0006 run budgets, 0007 buffer connections, 0800001 paddle billing.
All guarded (`if not exists`) so a fresh `supabase db push` converges.

`types/supabase.ts` is the hand-maintained Database type mirroring the live
schema.

---

## 5. UI system

- **Design tokens** (`app/globals.css` + `tailwind.config.ts`): SaasAble "ai"
  preset (light). Primary = professional indigo-blue ramp; `neutral` = cool-gray;
  semantic `theme.*` tokens (`theme-bg-default`, `theme-bg-paper`,
  `theme-text-primary/secondary`, `theme-divider`). Fonts: Archivo (display) +
  Figtree (body), wired via CSS vars. All agent UI uses `theme-*` tokens — keep
  new UI on the same tokens.
- **Component grammar**: `Card` (+ `CardHeader` with `title`/`description`/
  `action`), `badge` / `btn` / `btn-primary` / `btn-outline-primary` /
  `btn-light-primary`, `form-control` / `form-select`, `md-preview` (markdown),
  `caption`, `nav-link` / `side-nav-link`. Agents text UI uses
  `font-display`/`font-sans` via the h1-h4 reset.
- **Layout**: `app-shell.tsx` (Workspace group nav incl. `/agent`),
  `.workspace` container (1440 px) for app pages vs `.container` (1128/1266 px)
  for marketing. `middleware.ts` protects `/dashboard /upload /repurpose
  /branding /connections /library /agent /settings /content /reset-password`
  (+ account delete/export).
- **App pages**: dashboard (4s polling + optional Realtime), `/upload` (3 input
  modes), `/library`, `/repurpose/[id]` (output editor w/ Preview/Edit +
  regenerate + copy), `/branding`, `/connections`, `/settings/usage`, `/agent`.
- **Agent workspace** (`components/agent/`):
  - `agent-workspace.tsx` owns the run lifecycle against the durable API
    (startRun, poll/SSE via /api/agent/process, resume, cancel).
  - `outcome-composer.tsx` — P0 outcome-first entry: goal + intent
    (`create|plan|repurpose|improve|find_opportunities|build_week`,
    `lib/agent/outcomes.ts`); starts runs via the unchanged
    `POST /api/agent/runs {sourceId, mode}` machine contract.
  - `opportunity-feed.tsx` — passive strategy-next card (recommendation, ranked
    alternatives, budget, exclusions, honest spend), no LLM on GET.
  - `plan-view.tsx` — the human gate (opportunity tags + keep/skip + edit
    title/desc).
  - `timeline.tsx` — plain-language progress (`lib/agent/timeline-copy.ts`) over
    the durable steps; `run-list` / `run-detail` (budget + spend breakdown +
    "what the agent remembers"), `observe-panel`, `scale-panel`,
    `publish-queue-panel` (Buffer profile picker + send/schedule, human-gated).
  - `observe` page (`/agent/observe`) hosts observe + scale + publish-queue.

---

## 6. Test infrastructure

- **Unit/integration**: Vitest (`vitest.config.ts`, node env, alias `@` → root,
  include `**/*.test.ts`, exclude `node_modules`/`.next`). Tests are co-located
  `*.test.ts` next to the module (e.g. `lib/agent/budgets.test.ts`,
  `lib/agent/tools/distribution.test.ts`, `lib/billing/plans.test.ts`,
  `components/agent/strategy-panel.test.ts`). Mocking conventions: GraphQL
  op-dispatch mock in distribution tests; `vi.resetModules()` + `doMock` where
  module state must be isolated. Seed/live-DB tests are excluded — pure modules
  are preferred for the new logic.
- **Live verification** (reads `.env.local`, needs creds — do not run blindly):
  - `npm run verify:rls` → `scripts/verify-rls.mjs`: 24 checks, cross-user RLS
    on sources/outputs/profiles/events (+ ledger tables when migration 0004
    applied), user-delete cascade, WITH CHECK reassignment blocks.
  - `npm run verify:agentic` → `scripts/verify-agentic.mjs`: 38 checks for the
    six V4_ tables + buffer_connections: row shapes, budget/heartbeat columns,
    check-constraint rejections, cross-user isolation, cascade cleanup.
- **Commands**: `npm run test` (vitest run) — do NOT run `npm run lint` (broken
  scaffolder wizard on this box). Typecheck `npx tsc --noEmit` needs
  `.next/types` (run `npm run build` first if `.next` is stale/missing).
- **CI**: GitHub Actions typecheck → test → build (secrets-gated live verifier).

---

## Phase 1 implications (canonical source architecture)

Phase 1 wraps the *existing* YouTube + upload behavior behind an explicit
registry + adapter interface, adds canonical content + ingestion-lifecycle
types, and an evidence/provenance model. Findings that de-risk the work:

1. **`ingestSource()` switch is already the registry.** The seam is real: one
   function, one downstream contract (`TranscriptDocument`), per-type providers
   in `lib/ingestion/{upload,youtube,transcript}.ts`. Phase 1 should promote
   this into an explicit `SourceProvider` interface + registry
   (`lib/ingestion/registry.ts`) rather than invent a parallel one.
2. **Canonical content already exists**: `TranscriptDocument` (text, segments,
   language, duration, provider, providerTranscriptId, source metadata). It is
   persisted canonically to `transcripts`; `sources.transcript` is the denorm.
3. **Lifecycle is already typed** (`sources.status` / `jobs.status` /
   `transcripts.status` enums mirrored in `types/supabase.ts`). A canonical
   `IngestionLifecycle` type can map onto these without a migration.
4. **Evidence/provenance primitives exist**: `TranscriptSegment.startMs/endMs`
   + `parseSrt/parseVtt/segmentsToText`, verbatim `quotes` on `v4_content_ideas`,
   deterministic grounding in `evaluator.ts`, `provider`/`providerTranscriptId`
   on `TranscriptDocument`. Phase 1 should surface provenance as a first-class
   field/type (which provider, which transcript id, which segments) reusing
   these, not add a new store.
5. **No new intake surface**: Phase 1 must not add new UIs/routes (no
   PDF/URL/podcast ingest yet). The registry should define the *schema* for
   future kinds (`file|url|youtube|podcast|pdf|docx|image`) mapped onto the
   existing `IngestionSourceType` where they land today.
6. **Schema freeze is achievable**: the current schema (sources + transcripts +
   denorm) already carries lifecycle, provider history, and segments. Defer any
   new columns/migrations until a real gap is proven (e.g. a future `file`/`url`
   kind would relax the `source_has_location` check — do that migration *with*
   the new intake phase, not before).
7. **Test isolation**: new Phase 1 modules should be pure (no Supabase) with
   co-located `*.test.ts`; keep the process/worker tests and the 24 + 38 live
   checks green. `npm run build` before `tsc` for a clean typecheck.

---

## Phase 1 status — canonical source architecture (implemented)

- **`lib/ingestion/registry.ts`** — explicit `SourceProvider` adapter interface
  (`{ sourceTypes, ingest }`) + registry replacing the `ingestSource` switch.
  `mapKindToSourceType` declares the full intake taxonomy
  (`file | url | youtube | podcast | audio | video | transcript | pdf | docx |
  image`); only kinds with a real intake path map onto the DB enum — unregistered
  kinds return `null` so no provider can register a kind the schema can't store.
- **`lib/ingestion/index.ts`** — registers the three existing mechanisms
  (YouTube, uploaded media via audio+video, transcript file) as adapters, with
  **provider bodies untouched**. Worker route (`/api/process`) unchanged; it
  still calls the one `ingestSource()` entry point.
- **`types.ts`** — `CanonicalContent` alias over `TranscriptDocument` so new code
  speaks the canonical vocabulary without changing the persisted shape.
- **`lib/ingestion/lifecycle.ts`** (pure) — canonical `IngestionStage` vocabulary
  (`initiated → retrieving → ingesting → transcribing → producing → ready`),
  bidirectional mapping onto existing `sources.status` / `transcripts.status`
  enums, `canTransition()` guard, `STAGES_PER_SOURCE_TYPE` per-kind plan.
  No schema change needed: the existing enums already carry the lifecycle.
- **`lib/ingestion/evidence.ts`** (pure) — `TranscriptProvenance` (which provider,
  provider transcript id, language, duration, source attribution, segment count)
  + `Evidence` (verbatim quote pinned to exact segment + start/end ms), reusing
  the verbatim-normalization the planner/evaluator already use. `isPinned()`
  marks the strict grounded subset. No new store — provenance rides on
  `transcripts.provider/provider_transcript_id`, evidence on existing segments
  + `v4_content_ideas.quotes`.
- **Tests**: `registry.test.ts`, `lifecycle.test.ts`, `evidence.test.ts`
  (co-located, pure, matching repo style).
- **Checkpoint 1 = PASSED**: existing uploads/YouTube/transcript ingestion paths
  intact (same entry point, same providers), `tsc --noEmit` clean, all 267
  tests / 27 files green (241 baseline + 26 new), `npm run build` exit 0.
- **Migration decision: NONE.** The current schema (sources + transcripts +
  denormalised `sources.transcript`, `transcripts.status` enum) already carries
  lifecycle, provider provenance, and segments. A migration is deferred until a
  real gap is proven — e.g. a future `file`/`url`/`pdf`/`docx`/`image` intake
  phase would relax the `source_has_location` check, and that migration should
  ship *with* that phase, not before.
- **Deferred (explicitly out of scope, no UI/routes added)**: new intake kinds
  (pdf/podcast/url/file), per-run retrieval callbacks from providers to the
  dashboard mid-stage, and a migration. No new intake surface was created.

---

## Status (Checkpoint 0 verification)

Verified understanding of the six audit axes:

- [x] **Source flow** — enqueue→worker; `ingestSource` seam; three providers;
  `sources.status` + `jobs.status` + `transcripts.status` lifecycle.
- [x] **Output flow** — `outputs` table, three formats, deterministic
  evaluation, bounded regeneration, edit signals on agent drafts.
- [x] **Agent flow** — one durable orchestrator, tool registry + per-mode
  capabilities, human gate, P0 outcome-first composer, strategy engine, real
  human-gated Buffer publish, honest empty states.
- [x] **DB model** — migrations 0001→0800001 authoritative; RLS per-user;
  V4_ tables + budget columns; cascades; storage bucket policy.
- [x] **UI system** — theme tokens, card/badge/btn grammar, workspace layout,
  agent component inventory, protected routes.
- [x] **Test infra** — vitest co-located pure-module tests, verify-rls.mjs
  (24), verify-agentic.mjs (38), build-before-tsc, CI pipeline.

Report + map saved to `docs/IMPLEMENTATION_MAP.md`. Ready for Phase 1.

---

## Phase 1 — canonical source architecture (delivered)

Landing the uncommitted ingestion foundation (committed as the universal
ingestion baseline: `lib/ingestion/` registry + adapters + idempotency +
evidence + tests, `(app)` route group, migration `20260908000002`) and the
first real intake slice on top of it:

### Wire-up status
- The worker (`app/api/process/route.ts`) **already** routes every job through
  `ingestSource()` → the registry → the right adapter. The seam was the missing
  UI, not the worker.
- **New "Paste a link" mode** (`app/(app)/upload/page.tsx`): any public http(s)
  link becomes a source. YouTube links keep the existing `youtube` source_type
  and captions/audio path; everything else is stored as a `transcript` row
  located by `source_url` alone, and the worker classifies it at ingest time
  (web article/blog → fetch pipeline, podcast feed → RSS, supported-social /
  unknown → honest actionable error via `IngestionFailure`).
- **Markdown intake**: `.md` / `.markdown` added to the transcript file picker
  + `TRANSCRIPT_FILE_EXTENSIONS` (`lib/limits.ts`); the registry resolves the
  stored file to the `markdown` kind and the document adapter extracts it for
  real (`extractMarkdown`).
- **Migration `20260908000003_url_source_locations.sql`**: relaxes
  `source_has_location` so a `transcript` row may be backed by `source_url`
  alone (web article / podcast feed). Idempotent (guarded drop + recreate);
  `supabase/schema.sql` reference kept in sync.

### Not yet wired (honest seams, next phases)
- Idempotency store (`ContentStore`) is not injected in the worker yet — the
  `content_hash` column + unique index exist (…0002) but dedupe-on-ingest
  activates once the worker passes a store-backed adapter.

---

## Phase 2 — file extraction engines (delivered)

Wired real extraction for every file-backed intake kind. No content is
fabricated; empty results are rejected honestly by the adapters' guard.

- **`lib/ingestion/engines.ts`** (server-only): 
  - `pdfExtractor` — **pdf-parse** text extraction. Imports
    `pdf-parse/lib/pdf-parse.js` (the package root runs a debug self-test whose
    `module.parent` guard is falsy under vite-node/ESM transforms, crashing on a
    missing `test/data/*.pdf` fixture). NUL bytes that pdf-parse emits are
    stripped before canonical shaping; `metadata.pages` from `numpages`.
  - `docxExtractor` — **mammoth** `extractRawText`.
  - `imageExtractor` / `createImageExtractor` — Gemini vision (`gemini-3.6-flash`)
    via a deterministic prompt returning three grounded sections (Visible text /
    Description / Key messages). `parseImageAnalysis` + `imageTextFromAnalysis`
    shape the answer; a `NONE` marker is treated as "nothing visible", never
    content. The model is built lazily on first call, so importing engines never
    requires `GEMINI_API_KEY`. `retryOnOverload` wraps the vision call.
- **`types/ingestion-engines.d.ts`** — local ambient declarations for
  `pdf-parse` and `mammoth` (neither ships types), since the server-only module
  stays dependency-free of DefinitelyTyped.
- **`lib/ingestion/index.ts`** — providers now wire the real engines:
  `documentProvider({ extractors: { pdf, docx } })`, `imageProvider({ extractor })`.
  Engines re-exported for reuse.
- **`lib/limits.ts`** — `DOCUMENT_FILE_EXTENSIONS` (pdf, docx),
  `IMAGE_FILE_EXTENSIONS` (png/jpg/jpeg/gif/webp/bmp/heic/heif/avif),
  `FILE_BACKED_EXTENSIONS` + `isAllowedFileBackedExtension`.
- **`app/(app)/upload/page.tsx`** — transcript-mode picker now also accepts
  documents + images (`accept` list + validation moved to the file-backed gate).
- **Deps**: `pdf-parse`, `mammoth`.
- **Tests**: `lib/ingestion/engines.test.ts` (analysis parsing, canonical text
  assembly, engine-contract wiring, lazy key deferral). 351 tests / 36 files
  green, `tsc --noEmit` clean, `npm run build` exit 0.

Next step (Phase 3): inject a store-backed `ContentStore` into the registered
providers for real dedupe, and light up/polish the URL + podcast job, retry and
failure UX end to end.
- `verify:rls` / `verify:agentic` and live migrations …0002/…0003 still need
  a run against the live project (DB creds not in the repo).
## Phase 3 — idempotency store + live URL/podcast integrity (delivered)

- **`lib/ingestion/store.ts`** — `supabaseContentStore(service)` implements the
  `ContentStore` seam (findSourceByHash / transcriptTextFor / persistHash) and
  `registerStoreBackedProviders(store)` re-registers the document/image/url/
  podcast providers with it after module load. `ContentStore.persistHash?`
  + `persistHashSafely` (idempotency.ts) write the `{kind}:{sha256}` key to
  `sources.content_hash` after a non-reuse ingest; write-back failures never
  fail the job. The unique partial index from …0002 backstops row-level dedupe.
- **Worker (`app/api/process/route.ts`)** injects
  `registerStoreBackedProviders(supabaseContentStore(service))` once per
  request, before ingest.
- Re-exported through `lib/ingestion/index.ts` (`supabaseContentStore`,
  `registerStoreBackedProviders`, `persistHashSafely`) for reuse/tests.
- **Tests**: `lib/ingestion/store.test.ts` (store seam, no-op/absent-fallback),
  registry upgrade path. 356 tests / 37 files, `tsc` clean, build green.
- **Live verification**: real page fetch + `htmlToReadable` + real podcast RSS
  parse all succeeded against live URLs; `verify:rls` 29/29, `verify:agentic`
  38/38 (both green on the live project).

## Phase 4 — content intelligence engine (delivered)

Decoupled "understand this source" from "generate from it". A pure, LLM-free,
fully-grounded extractor turns a canonical transcript into a structured
`ContentIntelligence` artifact that the worker persists after every successful
ingest regardless of output formats.

- **`lib/intelligence/types.ts`** — schema: topics, themes, claims (stance
  assertion/conjecture/citation + heuristic confidence), verbatim quotes,
  stories, questions (with rhetorical flag), hooks (opening/stat/open_loop/
  rhetorical), entities, insights (cause_effect/contrast/generalization),
  derived opportunities, textStats + provenance. Every extraction carries an
  `EvidenceSegment` (verbatim text + char offsets).
- **`lib/intelligence/extract.ts`** — deterministic extractors:
  offset-preserving `splitSentences`; position-weighted topic TF; stem-lite
  theme clustering; claim scoring by stance markers + topic ties + numeric
  presence; quote-mark scanning; story runs via sequence markers; rhetorical
  detection via "set-up + immediately answered" rule; entity frequency with
  kind guessing; insight marker patterns. `deriveOpportunities` emits
  `synthesized: true` templates (question-led post, cold-open clip, claim post,
  story newsletter, pull-quote carousel) — explicitly derived, never generated.
- **`lib/intelligence/index.ts`** — `analyzeContent` (the only entry) +
  `assertGrounded` guard: every evidence segment must be a verbatim slice of
  the source text or the artifact is rejected before persistence.
- **Migration `…0004`** — `content_intelligence` table (jsonb artifact, one row
  per source via unique `source_id`, owner RLS policies, user index).
  Fully idempotent (policy/constraint guards). Applied to the live project;
  re-apply verified.
- **`types/supabase.ts`** — `content_intelligence` Row/Insert/Update types.
- **Worker** — `analyzeContent` → `assertGrounded` → best-effort upsert after
  `saveTranscript`, before generation; failures are logged, never job-fatal.
- **`scripts/verify-rls.mjs`** — cross-user checks for the new table (insert/
  read/update/delete isolation). 29 checks (was 24); live run green.
- **Tests**: `lib/intelligence/intelligence.test.ts` — 12 tests incl. offset
  integrity and the tamper-rejection guard. 368 tests / 38 files, `tsc` clean,
  build green.

Next step (Phase 5): an Output Registry — `OutputDefinition` + registry +
compatibility surface so opportunity→output recommendations (Phase 6) resolve
against a first-class catalog instead of a hard-coded list.

## Phase 5 — Output Registry (delivered)

Turned the hard-coded format arrays into a first-class catalog, so Phase 6's
opportunity→output recommendations and Phase 7's quality gate resolve against a
single source of truth instead of duplicated lists.

- **`lib/output-registry/types.ts`** — `OutputDefinition` (id, label,
  description, systemPrompt, optional `requiresEvidence` gate, optional
  `validation` bounds, `derived` flag), `OutputRecommendation`, `ValidationResult`.
- **`lib/output-registry/registry.ts`** — `OutputRegistry` (register / get /
  all / formats / recommend / validate) + singleton. `recommend(intelligence)`
  scores every registered definition against the intelligence artifact: outputs
  whose evidence gate (min topics/claims/hooks/quotes/questions/stories) is not
  fully met score 0 and are excluded; qualifying outputs score 0.5→1 by how far
  counts overshoot the minimum. `validate(id, content)` enforces word/char
  bounds — the raw material for Phase 7's quality gate.
- **`lib/output-registry/definitions.ts`** — the three built-ins
  (linkedin_post / newsletter / shortform_script) with their evidence gates,
  validation bounds, and the exact same system prompts generation always used.
- **`lib/output-registry/index.ts`** — registers built-ins at module load and
  re-exports the surface.
- **`lib/ai/prompts.ts`** — now a thin façade over the registry
  (`FORMATS`/`PROMPTS`/`buildSystemPrompt` shapes unchanged) so all existing
  callers keep working while the registry becomes the source of truth. New
  outputs added to the registry automatically appear everywhere.
- **Worker (`app/api/process/route.ts`)** derives its format list from
  `outputRegistry.formats()` instead of a hard-coded array.
- **Tests**: `lib/output-registry/registry.test.ts` (10 tests — built-in
  registration, gating/exclusion, monotonic scoring, validation bounds, unknown
  id, custom-definition extension point). 378 tests / 39 files, `tsc` clean,
  build green.

Next step (Phase 6): opportunity→output recommendations — map the intelligence
engine's derived opportunities to registry outputs with a "Let the Agent decide"
path.
