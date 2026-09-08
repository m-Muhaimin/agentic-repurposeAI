# UX Audit — RepurposeAI (Phase 0)

- **Scope**: UX audit only. No application code was changed. All findings are derived from reading current code.
- **Method**: Route inventory from `middleware.ts` + `app/` tree; per-page read of every authenticated route and the shared shell; inventory of shared primitives; gap-log against the Phase 1 (Global Shell) target IA.
- **Date**: 2026-09-08
- **Source of truth for the target IA and non-negotiables**: product direction notes (USER OBJECTIVE → UNDERSTAND → RECOMMEND → PLAN → CREATE → REVIEW → APPROVE → SCHEDULE/PUBLISH → LEARN; AI UX language Goal/Plan/Recommendation/Draft/Review/Approve/Publish; never expose agent internals — no tool calls, chain-of-thought, provider names, budgets/tokens).
- **Non-negotiables used for scoring**:
  1. Preserve the existing visual language (theme tokens, `btn-*`, `badge`, `.workspace`, Figtree/Archivo).
  2. No dead ends — every surface must push toward the next step.
  3. One obvious primary action per surface.
  4. Never expose agent internals (worker, durable, tool calls, CoT, budgets, tokens, provider names, `assist/execute/automate` raw).
  5. Info hierarchy L1 purpose → L2 needs attention → L3 actions → L4 supporting info → L5 advanced.

---

## 1. Authenticated route inventory

| # | Route | File | Nav label | Sections |
|---|-------|------|-----------|----------|
| 1 | `/dashboard` | `app/dashboard/page.tsx` | Home › Overview | Stats strip, plan/usage strip, sources list + CTA |
| 2 | `/upload` | `app/upload/page.tsx` | Create › New content | Source-type segmented control, format checkboxes, options, submit |
| 3 | `/library` | `app/library/page.tsx` + `app/library/source-list.tsx` (client) | Library › Content library | Filters, source rows, drafts, alerts, delete |
| 4 | `/repurpose/[id]` | `app/repurpose/[id]/page.tsx` + `components/output-editor.tsx` | — (no nav entry) | Draft editor, format tabs, save/copy/regenerate |
| 5 | `/agent` | `app/agent/page.tsx` + `components/agent/*` | Create › Agent | Outcome composer, context strip, run list, run detail, plan view, timeline |
| 6 | `/agent/observe` | `app/agent/observe/page.tsx` + `components/agent/publish-queue-panel.tsx`, `observe-panel.tsx`, `scale-panel.tsx` | Insights › AI learnings | Publish queue, run/step funnels + spend, scale/autopilot status |
| 7 | `/content/calendar` | `app/content/calendar/page.tsx` | Strategy › Content calendar | Stub (empty state, no data) |
| 8 | `/branding` | `app/branding/page.tsx` + `components/branding-form.tsx` | Brand › Brand & voice | Overview, tone-of-voice per format, forbidden terms |
| 9 | `/connections` | `app/connections/page.tsx` + `components/connections-youtube.tsx`, `connections-buffer.tsx` | Connect › Channels | YouTube, Buffer, Podcast (stub) |
| 10 | `/settings` | `app/settings/page.tsx` + `components/settings-form.tsx` | Account › Settings | Profile, notifications, billing, account |
| 11 | `/settings/usage` | `app/settings/usage/page.tsx` | Account › Plan & usage | Plan card, usage meter, recent jobs |
| 12 | `/reset-password` | `app/reset-password/page.tsx` | (protected by middleware; reached from email link) | Password reset form |

Public (outside audit but referenced by shell): `/` (marketing + pricing), `/login`, `/legal/terms`, `/legal/privacy`.

Middleware truth (`middleware.ts`): `protectedPaths = [/dashboard, /upload, /repurpose, /branding, /connections, /library, /agent, /settings, /content, /reset-password, /api/account/delete, /api/account/export]`; unauthenticated → `/login`.

The `app/` tree contains **no other** authenticated pages. `/api/agent/*`, `/api/repurpose/*`, `/api/usage/*`, `/api/billing/*`, `/api/integrations/*`, `/api/account/*` are API routes, not UI.

---

## 2. Global App Shell audit (`components/app-shell.tsx`)

Confirmed structure — there is **no root/group layout wrapping AppShell**; every one of the 11 authenticated pages imports and renders `<AppShell>` itself (`app/layout.tsx` only sets fonts + metadata). This is the Phase 1 target: a single nested layout that owns the shell.

### Nav groups (source of truth, `app-shell.tsx:9-246`)
- **Home**: Overview (`/dashboard`)
- **Create**: Agent (`/agent`), New content (`/upload`)
- **Library**: Content library (`/library`)
- **Strategy**: Content calendar (`/content/calendar`)
- **Insights**: AI learnings (`/agent/observe`)
- **Brand**: Brand & voice (`/branding`)
- **Connect**: Channels (`/connections`)
- **Account**: Plan & usage (`/settings/usage`), Settings (`/settings`)
- Footer: Log out, Terms, Privacy (`app-shell.tsx:311-344`)

### Desktop
- Fixed `w-64` sticky sidebar, logo (→ `/dashboard`), group captions, `side-nav-link` items with icons, active state = `active` class + `aria-current="page"`.
- **Active state is strict path equality** (`app-shell.tsx:353` — `const isActive = (href) => pathname === href`). Consequences:
  - `/repurpose/[id]` **never has an active nav item** — the editor shows no selected nav (orientation gap).
  - `/settings/usage`, `/agent/observe` match exactly and highlight correctly.
  - Any future nested route (e.g. `/settings/security`) would silently never highlight. Phase 1 should switch to prefix matching with an explicit "not nav" set.

### Mobile
- Sticky top bar with wordmark "Repurpose" + hamburger only (`app-shell.tsx:387-410`). No creation CTA.
- Drawer (`role="dialog" aria-modal="true"`, Escape closes, body scroll lock, `aria-label` present) reuses the same `SidebarContent`. Good a11y baseline.
- **No primary creation action in the shell on either breakpoint.** "New content" exists only as a nav link under Create; there is no `+`/prominent CTA. Every page invents its own primary action in its page header.

### Shell-level gaps (input to Phase 1)
1. No global "Repurpose / Create" CTA (sidebar primary button + mobile top-bar `+`).
2. No breadcrumbs anywhere.
3. No route-change loading indicator.
4. No global toast/snackbar (pages roll inline messages).
5. No global empty-state convention for the shell itself (each page owns it).
6. IA-label mismatches vs product direction — see §7.

---

## 3. Page-by-page audit

Legend: H1 = primary action (must be obvious), H2 = secondary, H3 = supporting.
States audited: empty / loading / error / success, flow entry→exit, dead ends, duplicated patterns.

### 3.1 Dashboard — `app/dashboard/page.tsx`
- **Purpose (L1)**: "Welcome back" overview — where your content stands and the top action.
- **H1**: "Repurpose content" (header) → `/upload`. H2: "View library →" (`/library`). Source rows show format chips + status badge + progress bar (polling).
- **Info hierarchy**: good — stats strip (sources, published outputs, shared sources, linked channels) → usage strip → sources with CTA in header.
- **Empty**: "No sources yet — add your first recording" EmptyState + CTA (good, no dead end).
- **Loading/Error**: sources section polling; error path returns a red alert role=alert (fine).
- **Dead ends**: source **rows are not clickable** (no per-row link into the source/drafts); the only onward affordance is header CTA + "View library". After uploading, the fresh source with drafts appears but the row gives no direct "open drafts" affordance.
- **Notes**: reuses `app/library/source-list.tsx` (shared). Duplicated date formatting (`timeAgo` here vs `formatDate` in library vs `usageDate` in usage page).

### 3.2 Upload — `app/upload/page.tsx`
- **Purpose**: manually create drafts ("Turn your content into LinkedIn, newsletter & short-form scripts").
- **H1**: "Repurpose content" submit. H2: source-type segmented control (Upload media / YouTube URL / Transcript), format checkboxes (LinkedIn post, Newsletter, Short-form script), "Add AI impact statements" option.
- **States**: busy label "Creating your drafts…" during ingestion; usage-limit gate served by `UsageNotice` (warns 80%+, blocks 100%). Upload validation error is inline red alert (catches long videos before transcription).
- **Flow**: submit → POST → on success `router.push("/dashboard")` — the upload page itself gives **no success state or link to the new source**; the user must find the row on the dashboard. Acceptable but abrupt; a "View your drafts" redirect with the new source highlighted would remove the dead-end feel.
- **Gaps**: no sticky action bar on mobile (form is short, so OK). No per-format guidance/additional context. The format set here and the format set in the agent differ in UX copy? (they share `FORMAT_LABEL` — but the editor re-declares it). Fine for now.

### 3.3 Library — `app/library/page.tsx` + `app/library/source-list.tsx`
- **Purpose**: browse sources and their drafts.
- **H1**: "Repurpose content" (header). H2: filter pills (All / Ready / Processing / Failed), per-row "View" (→ `/repurpose/[id]`), "Try again" on failed sources, delete (with bespoke confirm dialog), dismissible error alert.
- **States**: good empty state ("No sources yet…"), progress bar on processing rows, red alert + inline status colors. Success = the row status flips.
- **Dead ends**: none — the cleanest page in the app. Minor: no per-draft publish/schedule affordance (aligns with later phases).
- **Duplicates**: `FORMAT_LABEL` re-declared here (line ~11) and again in `/repurpose/[id]`, `run-detail.tsx`, `strategy-panel-helpers.ts`, `types/agent.ts` (5 copies of the same map). Source status vocabulary lives in `lib/status.ts` (shared — good) but the agent statuses are 3 separate maps elsewhere. The confirm-dialog is bespoke (no shared modal primitive).

### 3.4 Draft editor — `app/repurpose/[id]/page.tsx` + `components/output-editor.tsx`
- **Purpose**: review and refine a generated draft.
- **H1**: "Save changes" (after opening edit). H2: "Discard changes", format tabs (LinkedIn/Newsletter/Short-form), "Copy" (`CopyButton`), "Regenerate".
- **Back affordance**: "← Back to content library" (header link). No breadcrumb, **no nav active state** (see §2).
- **States**: unsaved-changes banner, word count + edited-at meta, "Saved." inline success, saved/`Published`/`In draft` badges.
- **Dead ends (highest severity in the manual flow)**: after a draft is saved/approved there is **no next step** — no "Publish / Schedule", no "View all drafts from this source", no "Create another", no link to the publish queue. The only exit is "Back to content library". This violates Non-negotiable #2 exactly where users sit with a finished asset.
- **Notes**: edit action bar sits at the bottom of the card — on mobile you must scroll past a long draft to reach Save (no sticky action bar).

### 3.5 Agent home — `app/agent/page.tsx` + `components/agent/*`
- **Purpose**: outcome-first content agent ("Welcome to your content agent").
- **L1→L3 hierarchy**: OutcomeComposer (goal textarea + intent chips + autonomy picker + source picker + H1 button) → context strip ("What your agent knows") → run list / opportunity feed → run detail / plan view / timeline.
- **H1**: "Start agent run" (or "Open recommendations" for `find_opportunities`). H2: intent chips (Create / Plan / Repurpose / Improve / Find opportunities / Build a week), autonomy segment (Assist / Execute / Automate), source selector.
- **States**: good skeletons in the panels; run detail polls with "Working…"; approval gate renders PlanView with an approve interaction; drafts open in editor.
- **Non-negotiable violations (internal voice leaking — see §6 for exact lines)**:
  - "Assist / Execute / Automate" + autonomy copy ("Automate is reserved for distribution (stubbed today)") exposes roadmap state.
  - Run list rows show raw mode (`assist`) as text meta.
  - RunDetail exposes "Kick planning worker", decision trail, budget `cost units / max`, per-step token usage, "Estimated spend", `published-rate estimate`.
  - Timeline: "View agent activity — N **durable** step", raw step-kind labels (planning/source/generation/review/distribution/strategy).
  - Workspace comment language ("survives restarts; catches up from the DB") is internal commentary, not user-facing, but the *surface copy* above is.
- **Dead ends**: after a run reaches `done`, drafts are listed with "Open in editor →" — that editor then dead-ends (§3.4). No publish path from run detail.

### 3.6 Observe / "AI learnings" — `app/agent/observe/page.tsx` + 3 panels
- **Purpose**: read-mostly honest snapshot (publish queue, run/step funnels + spend, scale/autopilot status).
- **H1**: none per page — it is a read-only dashboard with "Refresh". "Explore →" links back to `/agent` on panels.
- **Non-negotiable violations (worst offender)**:
  - Publish queue panel: **"Read-mostly. Nothing is published from here yet."** — openly tells users the product can't publish yet (aspirational-but-false affordance).
  - Observe panel: "Monthly agent spend", raw input/output token counts, "published-rate estimate".
  - Scale panel: "No autopilot door exists", "schedules are draft-only", permission-model jargon.
- **IA bug**: the **publish queue lives under Insights › AI learnings** — there is no "Publish" or "Queue" nav entry anywhere, so the only distribution surface is mislabeled and unreachable from the editor/dashboard. Highest-level IA gap.
- **Dead ends**: read-only by design; nothing publishable here; no actions lead anywhere.

### 3.7 Content calendar — `app/content/calendar/page.tsx`
- **Purpose**: future publishing calendar.
- **State**: honest stub — EmptyState "Nothing here yet."/"Your publishing calendar is coming soon. Drafts you approve will land here automatically." No action button.
- **Dead end**: placeholder with zero navigation or CTA (acceptable as a parked surface; should either be hidden or carry a "See your drafts" link).

### 3.8 Branding — `app/branding/page.tsx` + `components/branding-form.tsx`
- **Purpose**: "Your brand voice helps the agent write content that sounds like you."
- **H1**: per-card Save (Overview / Tone of voice per format / Forbidden terms). H2: chips input for forbidden phrases.
- **States**: inline "Saved."; multiple independent save buttons (no single global save → small H1-ambiguity, acceptable for a settings-like page).
- **Dead ends**: none. Good page.

### 3.9 Connections — `app/connections/page.tsx` + YouTube/Buffer cards
- **Purpose**: "Connect channels."
- **H1**: "Connect YouTube" / "Connect Buffer". H2: on the YouTube card, "Upload instead" link; on connected cards: "Disconnect".
- **States**: connected badges, per-platform status, disconnect confirmations.
- **Dead ends**: when connected, there is **no push to the publish queue or to repurpose** (a connected Buffer/YouTube loops back to nothing). Podcast card is a "Coming soon" disabled stub.
- **Notes**: you can reconnect (token refresh path exists). Duplicated connect/status UI across the two card components (candidate shared ChannelCard).

### 3.10 Settings — `app/settings/page.tsx` + `components/settings-form.tsx`
- **Purpose**: profile, notifications, billing, account.
- **H1**: per-card Save.
- **Non-negotiable/fake-affordance finding**: **notification toggles persist only to `localStorage`** (`settings-form.tsx:14, 131, 146`) and do not drive any server behavior — a promise of "notify me when a draft is ready" that the product never fulfills.
- **Dead ends**: "Delete account" box says self-serve is unavailable ("email us"); plan card points to "Paid plans are on the way" (honest). Settings has no sub-nav (flat) — target IA wants General/Usage/Security/Account.
- **Notes**: email field is read-only (auth identity) — good. No cross-link from settings to usage and vice versa.

### 3.11 Plan & usage — `app/settings/usage/page.tsx`
- **Purpose**: plan + compute/upload + recent jobs.
- **H1**: none expected (info). Usage meter + caption; usage notices; recent jobs list (source + status + date).
- **Dead ends**: none material; meter has no upgrade CTA (plans "on the way"). Linked from the plan card on `/settings`? (verify link) — usage is referenced from the dashboard/library plan card.
- **Duplicates**: `UsageMeter`/`UsageNotice` are shared (`components/usage-meter.tsx` — good).

---

## 4. Shared-primitive inventory (Phase 1 reuse base)

### Exist today (reusable as-is)
| Primitive | File | Notes |
|---|---|---|
| AppShell (nav shell) | `components/app-shell.tsx` | nav groups, drawer, a11y — extend, don't rebuild |
| PageHeader | `components/page-header.tsx` | title + description + action |
| EmptyState | `components/empty-state.tsx` | used well on dashboard/library/calendar |
| StatusBadge | `components/status-badge.tsx` + `lib/status.ts` | source-status vocabulary (shared) |
| Card / CardHeader / CardFooter | `components/card.tsx` | |
| SegmentedControl | `components/segmented-control.tsx` | paper/solid variants |
| UsageMeter / UsageNotice / parseLimitBody | `components/usage-meter.tsx` | |
| CopyButton | `components/copy-button.tsx` | |
| SourceList (shared rows) | `app/library/source-list.tsx` | reused by dashboard + library |

### Missing (build once in Phase 1)
| Missing primitive | Where it's currently hand-rolled |
|---|---|
| `Banner`/`Alert` (error/success/notice, dismissible) | source-list alert, output-editor status bar, usage notices, publish-queue bar, connections buffer notice — 5+ bespoke |
| `Toast` (or a decision to keep inline) | everywhere inline; no global snackbar |
| `Modal` / `ConfirmDialog` | delete-source confirm bespoke in source-list; none elsewhere |
| `Skeleton` loader | hand-rolled shimmer blocks in opportunity-feed, publish-queue, observe, scale panels |
| `StatusPill` (unified agent-status vocabulary) | 3+ parallel maps – see §5 |
| `FormatLabel` / `SOURCE_TYPE_LABEL` map | 5 copies of FORMAT_LABEL |
| `SourceCard` / `DraftRow` / `AgentRunCard` | repeated card markup across library/dashboard/agent |
| Breadcrumbs | none anywhere |
| Sticky action bar (mobile) | editor Save unreachable without scroll |
| Primary "Create/Repurpose" shell CTA | absent; only per-page headers |

---

## 5. Duplication log (consolidate in Phase 1)

1. `FORMAT_LABEL` (LinkedIn post / Newsletter / Short-form script): `app/library/source-list.tsx`, `app/repurpose/[id]/page.tsx`, `components/agent/run-detail.tsx`, `lib/agent/strategy-panel-helpers.ts`, `types/agent.ts` — 5 copies.
2. Agent status vocab: `RUN_LABEL` (`types/agent.ts`), `RUN_LABEL`+`RUN_STYLE` (`run-list.tsx`), `AGENT_STATUS_LABEL`/`AGENT_STATUS_STYLE` (`lib/status.ts`), `KIND_LABEL`/`STATUS_STYLE` (`timeline.tsx`) — 4 maps that should be one shared module.
3. Format/type label maps for source types (`SOURCE_TYPE_LABEL`) duplicated too.
4. Alert banners / inline status bars (5 bespoke variants).
5. Skeleton loaders (4 hand-rolled).
6. Date formatting: `timeAgo` (dashboard), `formatDate` (library), `usageDate` (usage page), inline `toLocaleDateString` calls elsewhere.
7. Connect/status card markup: `connections-youtube.tsx` vs `connections-buffer.tsx`.

---

## 6. Non-negotiable violations — internal voice leaks (fix in Phase 1 copy pass)

| Surface | Exact wording seen in code | File:line |
|---|---|---|
| Run detail | "Kick planning worker" / "Resume run" button | `components/agent/run-detail.tsx:415` |
| Run detail | cost-usage bar `cost units / max`, "Estimated spend", `input + output tokens`, `published-rate estimate`, decision trail | `components/agent/run-detail.tsx:333-402` |
| Run list | raw mode text (`assist`) in row meta | `components/agent/run-list.tsx` |
| Timeline | "View agent activity — N **durable** step" | `components/agent/timeline.tsx:112` |
| Opportunity feed | "Monthly agent spend", token counts, "spend source" | `components/agent/opportunity-feed.tsx:200-211` |
| Publish queue | "Read-mostly. Nothing is published from here yet." | `components/agent/publish-queue-panel.tsx:201` |
| Observe panel | "Monthly agent spend", token counts, `published-rate estimate` | `components/agent/observe-panel.tsx:143-157` |
| Scale panel | "No autopilot door exists", "schedules are draft-only" | `components/agent/scale-panel.tsx:96` |
| Composer | "Autonomy" + Assist/Execute/Automate + "(stubbed today)" | `components/agent/outcome-composer.tsx` |

Humanized replacements (product direction): "Analyzing your source" / "Finding strong angles" / "Creating drafts" / "Ready for review" / "Approved — drafting now"; mode picker couched as "How much help do you want?" (audit to recommend only; copy decisions for Phase 1+).

---

## 7. IA coverage vs target

| Target group | Actual nav | Gap |
|---|---|---|
| Home (Dashboard) | Home › Overview | OK |
| Create (Agent, Upload, **Quick Repurpose**) | Create › Agent, New content | No one-click "Quick Repurpose"; label "New content" ≠ target "Upload" |
| Content (Library, Drafts, Published, Ideas) | Library › Content library (+ calendar stub) | No Drafts/Published/Ideas surfaces |
| Strategy (Opportunities, Content Plan, Performance) | Strategy › Content calendar | Opportunities/Plan live inside `/agent`; Performance absent |
| **Distribution (Publish)** | **none** | **Publish queue mislabeled under Insights › AI learnings** |
| Brand (Branding) | Brand › Brand & voice | OK |
| Connect (Channels) | Connect › Channels | OK |
| Settings (General, Usage, Security, Account) | Account › Plan & usage, Settings | No Security page; Account inline in Settings; flat, no sub-nav |

---

## 8. Dead ends (severity-ranked)

1. **S1 — Draft editor is a dead end** (`/repurpose/[id]`): after save/approve, no Publish / Schedule / sibling-drafts / queue link. Users park completed work.
2. **S1 — Distribution surface is unreachable + mislabeled**: no "Publish"/"Queue" nav; the only queue is under Insights › AI learnings and openly says "Nothing is published from here yet."
3. **S1 — Agent surfaces leak internals** (see §6) — violates the core non-negotiable on the app's flagship feature.
4. **S2 — No active nav state in the editor** and strict-equality matching (`app-shell.tsx:353`).
5. **S2 — Notification toggles are localStorage-only** (`settings-form.tsx`) — fake affordance.
6. **S2 — Connected channels are dead ends** (only Disconnect; no repurpose/publish push); Podcast card is a stub.
7. **S2 — Fully-connected mobile flow lacks any shell-level create action**.
8. **S3 — Content calendar is a no-action stub** (ok as placeholder; add an onward link).
9. **S3 — Dashboard source rows aren't clickable** (no per-row link to drafts).

---

## 9. Highest-priority findings for Phase 1 (Global Shell)

1. Introduce a **single root layout** that owns `AppShell` (+ `metadata`), so pages stop re-wrapping themselves.
2. Add a **global "Repurpose / Create" CTA** in the shell (sidebar primary + mobile top-bar `+`), reducing per-page header CTAs to contextual secondaries.
3. Fix **nav active-state** to prefix matching; keep `/repurpose/[id]` resolving to Library (or add a proper editor nav entry). Add breadcrumbs.
4. Add **missing primitives** (Banner, Modal/ConfirmDialog, Skeleton, StatusPill, shared FORMAT_LABEL) and collapse the §5 duplication log.
5. **Humanize agent copy** (kill worker/budget/token/durable/autopilot/raw-mode language) — §6 list is the exact fix set.
6. Resolve the **Distribution IA** question: surface a real "Publish/Queue" entry and stop apologizing on the queue panel.
7. Remove or wire the **localStorage notification toggles** so the shell ships no fake affordances; park delete-account & podcast behind honest stubs that offer an onward action.
8. Give connected-channel and dashboard rows an onward action (repurpose / open drafts), defeating dead ends across the manual flow.

---

## 10. Blocker / ambiguities for Phase 1 (need decision before shell work)

1. **Distribution IA**: where does the publish queue live after Phase 1 — its own "Publish/Queue" nav group, or under Content/Library? The queue panel currently exposes "nothing published yet" — do we keep that surface or hide it until publishing is real?
2. **Editor nav identity**: does `/repurpose/[id]` sit under Library (active = Content library) or get its own entry? Breadcrumb convention?
3. **Mode/autonomy copy**: what customer-facing wording replaces "Assist / Execute / Automate" and the "autonomy" framing (product direction: levels MANUAL / ASSISTED / AGENT)? Copy sign-off required.
4. **Settings structure**: split into General/Usage/Security/Account sub-nav per target IA, or keep flat? Is a Security page in scope for Phase 2?
5. **Toast vs inline**: adopt a global toast system or keep the current inline-message convention? (Affects shell primitives list.)
6. **Notification toggles**: keep hidden until a server-backed implementation exists (Phase 2+), or leave functional-looking but local-only during Phase 1?
7. **"New content" label**: rename to match target IA ("Upload") or keep product term? Confirm with latest naming.
8. **Mobile create CTA**: does the global CTA replace the per-page header CTAs on upload/dashboard, or coexist?

---

*Phase 0 complete. No application code changed — this document records only observations. Validation status: unchanged (tsc, tests, RLS 24/24, agentic 38/38 untouched).*