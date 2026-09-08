# Security Incident Runbook

Response procedures for security incidents in the VervAI service. Adapt to the actual blast radius; do not skip the containment steps.

## Severity triage

- **P0 / Critical** — active data exposure, leaked service-role or provider key, RLS bypass in production, account-takeover vector, cross-user data access.
- **P1 / High** — credential rotation needed, ingestion SSRF regression, unbounded external fetch that stalls the worker fleet, Paddle webhook integrity issue.
- **P2 / Medium** — non-exploited misconfiguration, logging of sensitive data, dependency advisory.
- **P3 / Low** — hardening to schedule, docs gaps.

## P0: suspected cross-user data access or RLS bypass

1. **Contain immediately:** if it can be confirmed, disable the affected service role key and rotate it:
   - Supabase dashboard → Project Settings → API → rotate the service_role key. Update `.env.local`, the Vercel env var, and the GitHub repo secret in one pass.
2. **Verify scope:** run `npm --prefix W:/repupose-ai-v4 run verify:rls` against production to re-confirm the isolation suite is green.
3. **Audit for exploitation:** inspect `sources`, `outputs`, `jobs`, `content_intelligence`, `v4_agent_*` rows for anomalies (unexpected owner, cross-owner references). Use Postgres audit via the Supabase log explorer or `pg_stat_activity`.
4. **Preserve evidence:** capture the Supabase query logs for the incident window and the Vercel function logs; snapshot before any deletion.
5. **Notify:** per repo AGENTS.md, DB access details live in `W:/repupose-ai-v4/.env.local`; the production data is shared. Alert the owner before any destructive action.
6. **Learn:** file an incident using `docs/INCIDENT_TEMPLATE.md`.

## P0: leaked secret (API key, service role key, token encryption key)

1. **Rotate the key** (see above). The affected key is dead to you — assume it is public.
2. **Scan for exposure:** search git history and the working tree for the value pattern (see the exposure audit patterns: `eyJ`, `sk-`, `AIza`, `ghp_`, `xox`, `AKIA`, `BEGIN PRIVATE KEY`). Confirm none of the values are committed. `.env*` files are gitignored.
3. **Change dependent integrations** (Paddle webhook secret, encrypted Buffer/YouTube tokens use local encryption keys — rotating those keys requires re-encrypting stored tokens via the connect flows).
4. **Log the incident** with `docs/INCIDENT_TEMPLATE.md`.

## P1: ingestion SSRF or unbounded external call regression

- SSRF guards live in `lib/ingestion/url-validate.ts` (blocks private/loopback/metadata/CGNAT ranges) and `lib/ingestion/url-fetch.ts` (timeout + body cap). If a regression bypasses these, roll back the offending change and fix the guard, then add a regression test.
- If a worker step hangs on an unbounded external call, the orchestrator claim/resume + heartbeat will reclaim it after the stale window; still, treat a bare `fetch` without timeout as P1 and fix per `ARCHITECTURE_FREEZE.md` §3.

## P1: Paddle webhook integrity issue

- `app/api/billing/webhook/route.ts` verifies the Paddle signature and upserts idempotently keyed on `provider_subscription_id`. If signature validation is bypassed or a subscription is miswritten:
  1. Confirm the event came from Paddle (replay the payload via Paddle's API with the webhook secret).
  2. Correct the subscription row directly (service role only) or via a manual ledger correction.
  3. Run the billing tests and re-verify signed-only acceptance.

## Logging / data-handling hygiene

- Never log: API keys, tokens, transcripts, or plaintext user content at any level.
- `lib/agent/errors.ts` sanitizes provider error messages; keep that guarantee on future wrappers.
- `events`/`usage_events`/`subscription_events` are service-role write-only ledgers; clients must not read them — verified by `verify:rls`.

## Post-incident checklist
- [ ] Impact scope confirmed and contained
- [ ] Credentials rotated + CI/Vercel/local env synced
- [ ] RLS suite + agentic suite re-run green
- [ ] Root cause fixed with a regression test
- [ ] Incident documented using `docs/INCIDENT_TEMPLATE.md`