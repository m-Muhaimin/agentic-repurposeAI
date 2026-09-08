# Architecture Freeze

This document is the reference for what is locked in the VervAI codebase and what the current shape is, so future work does not unknowingly diverge.

## Scope
The freeze covers the runtime contracts below. It does NOT prevent bug fixes, P2/P3 hardening, or genuinely new features — it prevents silent drift of behavior that production depends on.

## 1. Output Registry is the single source of truth for "what outputs exist"

- **Path:** `lib/output-registry/` (`definitions.ts`, `registry.ts`, `types.ts`, `index.ts`).
- The built-in definitions `LIGEND_DEFINITIONS` (imported in `index.ts`) are registered into the module-level `outputRegistry` singleton at load.
- Any new output format must be added to `lib/output-registry/definitions.ts` FIRST. The registry drives `lib/recommendations` (evidence gates, scoring) and the UI-facing labels/descriptions.

### 1a. The legacy typed façade (`lib/ai/prompts.ts`)
- `OutputFormat` is a hard-coded union: `"linkedin_post" | "newsletter" | "shortform_script"`.
- `FORMATS` is `outputRegistry.formats()` filtered to those three ids; `PROMPTS[format]` mirrors the registry's `systemPrompt`.
- The façade intentionally does NOT surface new registry outputs into legacy generation/billing/agent code.
- **Freeze:** the façade and the registry must stay in agreement. The regression tests in `lib/output-registry/registry.test.ts` ("legacy façade ↔ registry alignment") pin this.
- **Known limitation (documented):** adding a new format to the registry will NOT make it appear in the legacy typed generation lists unless the `OutputFormat` union and its records are widened deliberately. This is a design boundary, not a bug. Do not "fix" it by leaking arbitrary registry ids into the union — that would silently change generation behavior.

## 2. AuthZ model: server-side identity + row-level RLS ownership

- Client components use `createClient` (anon + session) from `lib/supabase/server.ts` in Server Components; the service client `createServiceClient` is confined to `app/api/**` route handlers.
- `SUPABASE_SERVICE_ROLE_KEY` must never be imported by client bundles or `components/`. Existing guarantee verified by audit.
- Every row table carries `user_id` and per-user RLS policies (SELECT/INSERT/UPDATE/DELETE gated on `auth.uid() = user_id`). The migration `20260907000003_harden_update_policies.sql` makes every UPDATE policy's `WITH CHECK` explicit.
- **Freeze:** new tables must mirror this ownership pattern. New API routes must resolve identity from the session server-side and filter by `user_id`; do not accept the owner id from the request body.

## 3. External I/O is bounded — no infinite waits

- Every external call must have a bounded timeout or a bounded retry/poll budget. Reference patterns: `lib/ingestion/url-fetch.ts` (AbortSignal timeout + byte cap), `lib/ai/retry.ts` (`MAX_ATTEMPTS` + `MAX_TOTAL_RETRY_MS`), `lib/ai/transcribe.ts` (`MAX_TOTAL_POLL_MS`), `lib/ai/openrouter.ts` (`OPENROUTER_TIMEOUT_MS`).
- **Freeze:** new external calls adopt one of these patterns; a bare `fetch` with no timeout and no surrounding budget is a P1 defect.

## 4. Two retry/idempotency mechanisms exist and are both owned

- `lib/ai/retry.ts` — transient-overload retry for LLM generation (Gemini then OpenRouter fallback). Do not add a second retry framework.
- Orchestrator claim/resume + heartbeat in `lib/agent/orchestrator.ts` (v2 durable worker) and the v1 `lib/agent/orchestrator/` coordination index — the durable job state machine. Do not re-implement.

## 5. Provider fallback policy (generation)

- `lib/ai/generate.ts::generateOutput` prefers Gemini and falls back to OpenRouter ONLY on quota/rate-limit errors. Real prompt/content errors surface, not silently switch providers.

## Locked-config items

- `middleware.ts` session gate and protected-path list.
- `next.config.ts` `serverActions.bodySizeLimit` 25mb.
- `.gitignore` coverage for `.env*`, `.vercel`, and build output — secrets must not be tracked.

## Change review requirement
Any change affecting the contracts above (registry, façade, RLS policies, service-role scope, timeout/buffer budgets, provider fallback) must be reviewed against this document.