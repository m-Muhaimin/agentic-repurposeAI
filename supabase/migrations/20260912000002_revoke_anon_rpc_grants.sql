-- Revoke anon EXECUTE on client-facing RPCs (T5-fix).
--
-- Supabase's default privileges grant EXECUTE directly to `anon` for
-- functions created in `public`; the `revoke … from public` in the original
-- migrations cannot remove that direct grant (verified on the live project:
-- the anon key executed both notification RPCs with HTTP 200). This migration
-- targets the direct `anon` grant explicitly.
--
-- Every statement is idempotent — revoking a grant that does not exist is a
-- no-op — so this file is safe to run via the Supabase SQL editor against the
-- live project AND in `supabase db push` (re-running is a no-op).

-- ── notifications_mark_read / notifications_mark_all_read ──────────────────
-- Security-definer read-state mutations intended for authenticated users only
-- (20260912000001_notifications.sql). The `authenticated` grant is left
-- intact — the app calls these via the user-session client
-- (app/api/notifications/[id]/read + app/api/notifications/read-all).
revoke execute on function public.notifications_mark_read(uuid) from anon;
revoke execute on function public.notifications_mark_all_read() from anon;

-- ── enqueue_job ─────────────────────────────────────────────────────────────
-- Service-role-only reservation RPC (20260907000004_billing_ledger.sql:
-- "Only the service role may reserve jobs"). Revoke EXECUTE from anon AND
-- authenticated so no client role can call it directly — an authenticated
-- caller could otherwise pass an inflated p_max_jobs_per_month and bypass the
-- monthly cap. The service_role grant is untouched; the app calls this
-- exclusively via the service client (app/api/repurpose/route.ts).
revoke execute on function public.enqueue_job(uuid, uuid, text[], text, integer, integer) from anon;
revoke execute on function public.enqueue_job(uuid, uuid, text[], text, integer, integer) from authenticated;