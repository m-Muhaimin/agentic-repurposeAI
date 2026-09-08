# Repository Lockdown

Rules and checks that keep the VervAI repository production-safe. Reviewed at HEAD `57a33e7` during the final production-hardening pass.

## 1. Secrets never enter the repo

- `.gitignore` covers `.env`, `.env.local`, `.env.txt`, `.env*`, and `.vercel`.
- The `verify:rls` / `verify:agentic` / build-time tooling reads secrets from `.env.local` or process env only — never from tracked files.
- Exposure audit (git history + HEAD tree + working tree) is CLEAN for real secret values:
  scanned `eyJ` (JWT), `sk-`, `AIza` (Google), `ghp_` (GitHub), `xox` (Slack), `vcp_` / `gsk_`, `AKIA` / `BEGIN PRIVATE KEY` — zero actual secret values found. Only env-var NAMES (e.g. `SUPABASE_SERVICE_ROLE_KEY`) appear in code/docs.

## 2. Service role key is server-only

- `SUPABASE_SERVICE_ROLE_KEY` is consumed only by `lib/supabase/server.ts::createServiceClient()`.
- `createServiceClient` is used only in `app/api/**` route handlers (server-side). No `.tsx` component, no `components/` file, and no `app/(app)/**` page imports it.
- `lib/supabase/client.ts` uses only the anon key + URL.
- **Rule:** never import the service client into client bundles; never prefix a service-role env var with `NEXT_PUBLIC_`.

## 3. Git hygiene

- Do not commit with `--no-verify` (pre-commit checks, once wired, are mandatory).
- Never force-push to `main`. Never `git reset --hard` against shared history.
- Before any commit: `git status --short` → stage only intended files → never stage `.env*`.
- Uncommitted pre-existing working-tree changes (from before the final pass) were left as-is and are NOT part of this pass:
  - `M scripts/brand-check.mjs` (README H1 whitelist)
  - `D scripts/check-brand.mjs`
  - `D scripts/check-brand.ts`
  - `?? scripts/VERIFICATION_RECIPE.md`

## 4. CI is the gate

`.github/workflows/ci.yml`:
- `build` job (typecheck + tests + build) runs on every push/PR — mandatory.
- `verify-live-db` job runs the two live-DB smoke suites, gated at **step level** on `env.SUPABASE_SERVICE_ROLE_KEY != ''` (job-level `if: secrets…` is rejected by GitHub Actions — see the comment in the file). If credentials are absent, a clear "skipped" step reports instead of failing the workflow.

## 5. Brand check

- `scripts/brand-check.mjs` exits non-zero on legacy "RepurposeAI" branding outside allowed contexts.
- Currently 2 historical occurrences in pre-existing untracked files (`scripts/VERIFICATION_RECIPE.md`, `marketing-docs/research/MARKETING_BASELINE.md`) are flagged. They were not introduced by this pass and are left as-is; whitelist or remove them in a follow-up if a green exit is required.

## 6. Docs that must ship with any hardening claim

- `docs/PRODUCTION_READINESS.md`
- `docs/ARCHITECTURE_FREEZE.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/SECURITY_INCIDENT_RUNBOOK.md`
- `docs/INCIDENT_TEMPLATE.md`
- (this file)

## 7. Change review
Any change touching RLS policies, service-role usage, external-call timeouts, the output registry/façade, or CI gating must be reviewed against `docs/ARCHITECTURE_FREEZE.md`.