-- Security hardening: make every UPDATE policy's owner check explicit.
--
-- PostgreSQL already falls back to the USING expression when WITH CHECK is
-- omitted, so these drop+recreate pairs are functionally identical today —
-- the point is defense-in-depth and self-documentation: a future contributor
-- tightening a USING clause cannot silently loosen the accepted-new-row check.
--
-- Also drops the 0010-era note: update policies that intentionally allow
-- cross-row writes (none here) should say so in comments.

-- sources
drop policy if exists "Users can update their own sources" on public.sources;
create policy "Users can update their own sources"
  on public.sources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- jobs
drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs"
  on public.jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_prompts
drop policy if exists "Users can update their own prompts" on public.user_prompts;
create policy "Users can update their own prompts"
  on public.user_prompts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- youtube_connections
drop policy if exists "Users can update their own YouTube connection" on public.youtube_connections;
create policy "Users can update their own YouTube connection"
  on public.youtube_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transcripts
drop policy if exists "Users can update their own transcripts" on public.transcripts;
create policy "Users can update their own transcripts"
  on public.transcripts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Intentionally NO update policies on:
--   public.profiles  - plan is server-only; clients read, never write
--   public.events    - service-role write-only ledger
--   public.outputs   - content edits go through /api/outputs/[id] (service
--                      role) so regeneration budgets and length caps apply;
--                      a raw client UPDATE of outputs is deliberately blocked.