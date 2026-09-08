# Rollback Runbook

How to roll back VervAI safely: code (Vercel), database schema (Supabase), and the git working-tree states relevant to this production pass.

## 1. Code rollback (Vercel)

- The deploy is `games-server/aviator-nextjs` under the `ddsbddshns-projects` scope.
- To roll back to the previous deployment: in the Vercel dashboard, open the project → Deployments → select the last known-good production deployment → "Promote to Production" (or redeploy).
- Always do a fresh `vercel --prod --cwd <project> --scope ddsbddshns-projects -t <token>`, never `vercel redeploy` (per repo AGENTS.md).
- Rollback is instant and stateless — nothing here depends on a shared mutable code version beyond the Vercel deployment graph.

## 2. Git rollback for this pass

This pass does **NOT** commit anything. If a previous commit must be reverted:

```bash
git log --oneline -5            # identify the commit to roll back to
git revert <sha>                 # safe revert (creates an inverse commit)
```

Do NOT use `git reset --hard` / force-push on `main` unless also handling the remote — history is shared.

To discard the uncommitted working-tree changes from this pass (the three files touched) and return to HEAD `57a33e7`:

```bash
git checkout -- .github/workflows/ci.yml lib/ai/openrouter.ts lib/output-registry/registry.test.ts
```

The docs added under `docs/` are additive and safe to leave or remove.

## 3. Database rollback

### Schema
Migrations live in `supabase/migrations/`. This pass makes NO migration changes — there is no DB schema to roll back from this pass.

For any future migration that was applied and must be removed, the migrations are idempotent and guarded (see header comments, e.g. `20260907000003_harden_update_policies.sql`). Rollback strategy per table:

| Table group | Rollback action |
| --- | --- |
| RLS policy changes | `drop policy if exists "<name>" on "<table>"` then re-run the previous policy |
| Constraints added by a migration | Drop the constraint, keep the data. Migrations are additive; no data-destroying migration exists here |
| `content_intelligence` | Non-destructive — delete table only if re-applying 0004+ in order |

### Data
There is no destructive data operation in this pass. The `verify:rls` / `verify:agentic` scripts create throwaway users and clean up after themselves (cascade via FK on user delete).

## 4. Environment / secrets

- If a provider key is rotated, update `.env.local` AND the corresponding repo secret (CI) or Vercel environment variable. Never commit the value.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN` rotation requires updating `.env.local`, the Vercel env var, and the GitHub repo secret together for CI parity.

## 5. Verify rollback health

After any rollback:
1. `npm --prefix W:/repupose-ai-v4 run build`
2. `node_modules/.bin/tsc --noEmit`
3. `npm --prefix W:/repupose-ai-v4 test`
4. `npm --prefix W:/repupose-ai-v4 run verify:rls`
5. `npm --prefix W:/repupose-ai-v4 run verify:agentic`