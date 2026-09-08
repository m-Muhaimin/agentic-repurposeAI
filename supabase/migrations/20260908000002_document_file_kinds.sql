-- Phase 2: file-backed intake kinds (pdf/docx/markdown/txt/srt/vtt/image).
--
-- No enum change: every stored-file kind rides the existing `transcript`
-- source_type (the source_has_location check already accepts storage_path rows),
-- so pdf/docx/image rows need no migration to be stored.
--
-- What this adds is the idempotency anchor for "same input re-ingested does not
-- duplicate sources/assets": content_hash (sha256 of raw bytes, {kind}:{hash}
-- keyed by user + source_type) + a partial unique index so the same bytes for
-- the same user and kind can only ever exist once. The adders (providers /
-- upload surface) write it; the index backstops row-level dedupe the way
-- jobs.idempotency_key does for enqueues.
--
-- Idempotent: column guard + index guard, safe to re-apply on the live project.

alter table public.sources
  add column if not exists content_hash text;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'sources'
      and indexname = 'sources_user_type_hash_unique'
  ) then
    create unique index sources_user_type_hash_unique
      on public.sources (user_id, source_type, content_hash)
      where content_hash is not null;
  end if;
end $$;