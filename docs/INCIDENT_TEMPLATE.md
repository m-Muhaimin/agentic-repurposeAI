# Incident Template

Use this template for any security or reliability incident. Every field matters; fill what you know, mark the rest TBD and update as facts arrive.

## Identity
- **Date/time (UTC):**
- **Severity (P0-P3):**
- **Opened by:**
- **Status:** open / investigating / contained / resolved

## Summary
> One or two sentences: what happened, what was affected, current state.

## Timeline
| Time (UTC) | Event |
| --- | --- |
|  |  |
|  |  |

## Scope
- **Systems/data affected** (Supabase tables, Vercel functions, credentials, external providers):
- **Users/data at risk:**
- **Evidence preserved** (log snapshots, query logs, deploy IDs):

## Root cause
> What actually caused it. Reference file/line and mitigating processes.

## Containment
> What was done to stop the bleeding, incl. credential rotation + env sync (local / Vercel / GitHub secrets).

## Fix
> Code + migration + config changes made (and the PR/commit once landed).

## Verification
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `npm run verify:rls` green (29/29)
- [ ] `npm run verify:agentic` green (38/38)
- [ ] Blast radius re-checked

## Lessons
- What was missed:
- Preventative change for future (include a regression test):
- Follow-up (assignee / tracker):

## Closure
- **Closed by / date:**
- **Follow-up ticket(s):**