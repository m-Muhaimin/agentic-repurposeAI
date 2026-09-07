# Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ open · 🔵 user action (not code).

> Read this against reality first: the repo already has an enqueue→worker job pattern
> (`/api/repurpose` is enqueue-only, `/api/process` is a claim-based worker with a
> 10-min stale window), a full `sources.status` enum, 4s dashboard polling + optional
> Realtime, and server-side auth + ownership checks on every API route. Several Phase 1
> items below are listed as ✅/🟡 for that reason.

## Phase 0 — Security hygiene
| Item | Status | Notes |
|---|---|---|
| Rotate the exposed Gemini key, remove from scaffold | 🔵 | `.env.local` is gitignored, but the key was shared in conversation; rotate it and store in Vercel/Supabase env vars only. |
| API keys to platform env vars only | 🔵 | Nothing committed; still, add them in Vercel project settings, never in the repo. |
| RLS review — confirm sources/outputs can't be read cross-user | ✅ | `npm run verify:rls` (`scripts/verify-rls.mjs`): creates two throwaway users and asserts B can't read/update/delete/forge-own A's rows; also proves user-delete cascade. 12 checks passing. |
| Server-side auth on every API route | ✅ | `auth.getUser()` + ownership `.eq("user_id", user.id)` in repurpose, sources, sources/[id], prompts, regenerate. |

## Phase 1 — Reliability & correctness
| Item | Status | Notes |
|---|---|---|
| Off the sync request path | ✅ | Already enqueue-only + `/api/process` worker with atomic claim and stale re-claim. |
| Job status tracking | ✅ | `sources.status` enum + `jobs.status`. |
| Realtime/polling UI | ✅ | GPS found: dashboard polls `/api/sources` every 4s, re-kicks queued jobs; Realtime subscription optional. |
| Retry/backoff | ✅ | `lib/ai/retry.ts` (revived) wraps Gemini `generateContent`: honors Google's `RetryInfo.retryDelay`, exponential backoff, 90s cap, then OpenRouter fallback on quota/429. `lib/ai/transcribe.ts`: submit retried on 429/5xx; polling uses adaptive backoff (3s→20s) with a 10-min cap inside the worker's stale window and fails loudly after 3 consecutive transient errors. |
| Idempotency | ✅ | Claim filter + `status !== "uploaded"` 409 guard prevent double-processing/double-charge. |

## Phase 2 — Input validation & abuse prevention
| Item | Status | Notes |
|---|---|---|
| File size/duration limits | ✅ | `lib/limits.ts` caps (env-overridable: `MAX_SOURCE_FILE_MB` default 200, `MAX_INPUT_SECONDS` default 2h). Client rejects before upload; worker re-checks the stored object; YouTube duration probed before download. Manual-upload duration isn't probed (would require downloading the file server-side first) — noted in code. |
| MIME-type validation | ✅ | Client validates `file.type` + extension; worker gates on the storage object's metadata + a strict extension allowlist (`SOURCE_FILE_EXTENSIONS`). Magic-byte sniffing deliberately skipped (egress cost, AssemblyAI rejects garbage anyway). |
| Rate limiting `/api/repurpose` | ✅ | `lib/rate-limit.ts`: per-user rolling minute count of jobs in the `jobs` table (index `jobs_user_created_idx` in schema). 429 + `Retry-After`; fails open if the check errors. |
| YouTube URL validation | ✅ | `lib/youtube-url.ts` strict parser (watch/shorts/embed/live/youtu.be, 11-char id, rejects channels/playlists/music); worker probes availability + duration before download and maps yt-dlp errors to friendly messages (`describeYoutubeError`). |
| Content moderation / ToS | ✅ | Decision: rely on the shipped abuse-prevention caps (size / duration / rate / URL strictness) plus plain-English Terms & Privacy pages (`/legal/terms`, `/legal/privacy`, linked from login + app shell). Automated transcript scanning deferred until there's real volume — false positives + extra AI cost outweigh the risk at MVP scale. Pages are NOT lawyer-reviewed and the `CONTACT` email is a placeholder: fix both before public launch. |

## Phase 3 — Monetization
| Item | Status | Notes |
|---|---|---|
| Stripe Checkout + Billing Portal, subscriptions gated by RLS | ⬜ | Skipped for now (README has a placeholder section). |
| Usage metering + server-side plan limits | ⬜ | Skipped for now. |
| Free tier / trial limits | ⬜ | Single biggest cost-control lever for margin. |
| Stripe webhooks with signature verification | ⬜ | Skipped for now. |

## Phase 4 — Product polish
| Item | Status | Notes |
|---|---|---|
| Prompt tuning (user samples → few-shot) | 🟡 | Custom prompts + brand voice exist (`/branding`, `user_prompts`). Few-shot from pasted user samples is the next step — real differentiation. |
| Editable/regenerable outputs | ✅ | `output-editor.tsx` (Preview/Edit tabs, Discard/Save) + regenerate route. |
| Copy-to-clipboard / export / "post to LinkedIn" | 🟡 | `copy-button.tsx` exists; no export or LinkedIn posting. |
| Onboarding: empty states, samples, demo mode | 🟡 | Empty states exist (dashboard "No recordings yet" CTA, editor save guard); no samples/demo mode. |
| User-facing error states | ✅ | Upload page alerts on invalid file/URL; enqueue failures surface with a recovery hint; failed source cards show the message + "Try again" (re-enqueues via `/api/repurpose`, now accepts `failed`); uploaded-without-a-job cards get "Start processing"; SSE `error` events trigger a refetch; editor/regenerate show inline errors. |
| Connect your YouTube channel (OAuth captions) | 🟡 | `youtube_connections` table + `/api/integrations/youtube/{connect,callback,status,videos,disconnect}`; ingestion prefers the video's own captions (`lib/youtube/client.ts` + `lib/captions.ts`), falling back to the legacy yt-dlp path (archived at `lib/ingestion/providers/ytdlp.ts`) when unavailable. Tokens AES-GCM encrypted at rest (`YOUTUBE_TOKEN_ENCRYPTION_KEY`). Code-complete; live verification blocked on Google OAuth client creds (`GOOGLE_CLIENT_ID/SECRET`) and the schema migration being run in the Supabase SQL editor. Cookie-sync extension + `/api/youtube/*` routes retired. |
| Canonical transcripts table | ✅ | `transcripts` table (one row per `source_id`, RLS per-user, upgrade-safe from missing-table) + `saveTranscript` in the worker after `ingestSource`, so the final transcript (provider, language, duration, full text) is durable, not just the denormalised `sources.transcript` column. All four commits of the ingestion refactor are landed; remaining asks are the OAuth live-verification steps above. |
| Upload your own transcript (SRT/VTT/TXT) | ✅ | `"Transcript"` mode in the upload page; shared `lib/captions.ts` (SRT + VTT parsers, entity decoding, `segmentsToText`); `lib/ingestion/transcript.ts` provider feeds subtitle cues with timestamps straight into `TranscriptDocument` or falls back to plain text for `.txt` inputs. `source_type` extended to `'transcript'`; own file + `storage_path` (no AssemblyAI cost). |

## Phase 5 — Observability & ops
| Item | Status | Notes |
|---|---|---|
| Structured logging on AI calls & job transitions | ✅ | `lib/logger.ts` (JSON, zero-dep, optional `LOG_WEBHOOK_URL` forward) wired through AssemblyAI submit/poll, Gemini/OpenRouter calls (with latency), and job claim/complete/fail in `/api/process`, `/api/repurpose`, regenerate. |
| Cost monitoring/alerting (Gemini + AssemblyAI) | 🟡 | duration + event logs exist but nothing aggregates into spend/quotas yet. |
| Analytics on activation funnel | ⬜ | Nothing. |
| Uptime monitoring on API routes | ⬜ | Nothing. |

## Phase 6 — Legal / compliance
| Item | Status | Notes |
|---|---|---|
| ToS + Privacy Policy (user-uploaded audio/video) | 🟡 | Plain-English pages at `/legal/terms` + `/legal/privacy`, linked from login + app shell. Not lawyer-reviewed; `CONTACT` email placeholder (`support@repurpose-ai.app`) must be replaced before launch. |
| Data retention + Storage cleanup job | 🟡 | DB-level cascade exists (`outputs`/`jobs` FK → `on delete cascade`, all tables → `auth.users` cascade), so deleting a source/user cleans rows; no route to do it and no cleanup of Storage objects. |
| GDPR basics (export, account deletion cascade) | ⬜ | No export route; no delete-account flow. |

## Suggested sequencing
Phase 0 → 1 → 2 before public launch, Phase 4 as ongoing iteration, Phases 5/6 in parallel once 1–3 are stable. Given the current state, the fastest real wins are: 🔵 rotate key → RLS second-account test → Phase 2 (size/MIME caps + rate limiting + YouTube URL hardening) → revive retry.ts for AssemblyAI.