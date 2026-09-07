# Legal review checklist (pre-launch)

Status: **PENDING LAWYER REVIEW**. Do not publish the live legal pages (they now render a
"Not legal advice — pending review" banner) to a public release until a qualified human
lawyer has signed off on the items below and the placeholder support email is replaced.

Sources under review:
- `app/legal/terms/page.tsx` — Terms of Service
- `app/legal/privacy/page.tsx` — Privacy Policy

The placeholder contact on both pages is `[TODO: replace with real support email before launch]`.
A real support email must be supplied by the owner before launch (see Item 1 of the launch
checklist). Do NOT invent one and do NOT ship `support@repurpose-ai.app` (flagged as a blocker).

---

## Blocker: support email

- [ ] **Required before launch.** Owner to provide the real support email address. It is
      referenced on both pages (`href="mailto:${CONTACT}"`). Without a working contact, the
      ToS takedown process and the Privacy "Questions & changes" section are unsatisfiable.

---

## Privacy Policy claims a lawyer must verify

Each claim below is a factual/legal assertion that must be confirmed (and, if wrong, either
corrected in the doc or fixed in the code so the claim becomes true).

### What we store
- [ ] "password is stored by the authentication provider, not by us" — confirm the Supabase
      Auth delegate confirms this, and that no application code ever writes passwords to app tables.
- [ ] "audio/video files you upload, transcripts … written drafts … prompt or brand-voice settings"
      — confirm this enumeration matches the actual `sources`/`transcripts`/`outputs`/`user_prompts`
      storage model.
- [ ] YouTube connection record: "channel id and name, and encrypted session tokens … stored
      encrypted with a key held only by us" — confirm `YOUTUBE_TOKEN_ENCRYPTION_KEY` (AES-256-GCM,
      see `lib/crypto.ts` / `youtube_connections`) backs this claim, and that revocation from the
      upload page actually deletes the tokens (verify against the connections code path).

### Who processes the data
- [ ] Sub-processor list is complete and current: Supabase, Vercel, AssemblyAI, Google Gemini
      and/or OpenRouter, Google (YouTube). Confirm this is the exhaustive set of data recipients
      and their respective data-processing agreements / policies are in place as controllers or
      processors per GDPR Art. 28. Any new processor (e.g. a future Paddle as payment provider)
      must be added here.
      (UPDATE: the Paddle integration scaffold — `lib/billing/paddle.ts`, `/api/billing/checkout`,
      `/api/billing/webhook`, migration `20260908_0001_paddle_billing.sql` — now exists and is
      inert until the owner sets `PADDLE_*` env. Review this disclosure BEFORE flipping to a live
      seller account. Lines 100-102 and 112 below track the same dependency.)
- [ ] "AssemblyAI sees your audio, Google Gemini sees your transcript plus the prompt" — confirm
      the actual data flows (who receives media vs. transcript vs. prompt) match this.

### When content is deleted
- [ ] "Deleting a single recording … removes its audio file, transcript, and drafts." Confirm the
      delete flow (route + storage removal + cascade) actually achieves this.
- [ ] "Deleting your account removes your account details." Confirm the account-deletion route
      (`app/api/account/delete/route.ts`, admin `deleteUser`) plus FK cascades satisfy this, and
      whether storage-bucket objects under the user's prefix are also removed (see "Orphan cleanup"
      under Item 3/4 below — currently an open question).
- [ ] "Data is also removed from the providers above on the schedules they publish" — this is a
      claim about third-party retention schedules; a lawyer should confirm this is appropriately
      scoped (it references external, changeable schedules).
- [ ] "some copies can linger in backups or caches for a short time afterward" — confirm whether
      this adequately discloses Supabase PITR backup retention / provider caches.

### Children
- [ ] "isn't directed at children … don't knowingly collect their personal information" — confirm
      this is a defensible child-safety claim (COPPA/GDPR-K considerations) given there is no
      explicit age-gate in the signup flow.

### Questions & changes
- [ ] Material-change notice ("last updated" date) — confirm practice of updating the date
      satisfies the notification requirements in each applicable jurisdiction.

---

## Terms of Service claims a lawyer must verify

- [ ] Territorial/jurisdiction language: "these terms are a plain-English summary … not legal
      advice" — a lawyer should assess whether the Terms are intended to be a binding agreement and
      whether governing-law/jurisdiction and dispute-resolution clauses are needed and present
      (currently absent).
- [ ] "You keep ownership of everything you upload" — confirm IP assignment/licence grant to us
      (none is currently granted) is the intended model; if we need a licence to process (e.g. to
      feed Google Gemini), a grant must be added.
- [ ] "You may not upload anything that is illegal, infringes someone else's rights, or is
      intended to help someone else break the law" — align with the unresolved content-moderation
      policy (Item 6): if an automated moderation model (e.g. Gemini on transcripts) is adopted,
      the Terms should mention it and the Privacy Policy may need to disclose that transcripts are
      screened.
- [ ] "AI output is a draft … may be wrong, misleading, or off-brand … You are responsible for
      what you do with the output" — confirm the AI-output disclaimer is adequate.
- [ ] "Fair use & automated abuse … accounts that repeatedly abuse the service may be throttled
      or suspended without notice" — confirm the automated use-limits (enforced via `lib/billing/plans.ts`
      + `enqueue_job`) match this claim, and `totalJobs`/`usage_events` accounting is accurate.
- [ ] "Liability … 'as is' … maintainer isn't liable …" — the exclusion/warranty-disclaimer and
      limitation-of-liability clauses should be reviewed for enforceability per jurisdiction
      (GDPR does not allow excluding certain rights; statutory consumer rights in e.g. the EU, UK,
      AU cannot be excluded).
- [ ] "Takedowns & changes … email us … and we'll review and remove it promptly" — confirm the
      contact routing and that the privacy/CONTACT email is real (blocker above); consider whether
      a formal DMCA/notice process is required given user generation is mostly transcripts/drafts.
- [ ] **New:** paid tiers — the Paddle checkout/webhook scaffold (Item 2) is now implemented
      (`lib/billing/paddle.ts`, `/api/billing/checkout`, `/api/billing/webhook`) but inert until
      the owner supplies Paddle sandbox/live credentials + price ids. When billing ships, the
      Terms and Privacy must add: payment processor (Paddle) as a sub-processor, refund/
      cancellation policy, subscription terms, and the cancel-at-period-end / grace-period
      behavior we actually implement. Flag for the lawyer once billing is live.

---

## Before the banner comes down

- [ ] Real support email supplied and placed in `app/legal/terms/page.tsx` + `app/legal/privacy/page.tsx`.
- [ ] Every `[ ]` above verified by a human lawyer (or explicitly waived in writing by the owner).
- [ ] Remove the "Not legal advice — pending review" banner from `components/legal-doc.tsx`
      (lines added in the current uncommitted change).
- [ ] If Paddle/paid tiers are live, add the payment/refund/sub-processor disclosures above first.
