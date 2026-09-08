-- Phase 1: URL-backed sources (web articles, blog posts, podcast feeds).
--
-- The intake taxonomy already routes a `sources` row to the URL/podcast
-- adapters whenever it carries a `source_url` and no stored bytes, but the
-- source_has_location constraint only allowed that for youtube rows. Relax it
-- so a `transcript` row may be located by URL alone — how a fetched web page or
-- podcast feed is persisted (source_type stays on the existing enum; the
-- registry dispatches by URL content at ingest time). youtube keeps requiring
-- source_url; audio/video still require storage_path.
--
-- Idempotent: the constraint is dropped (guarded) and recreated with the
-- relaxed definition each run, so re-applying on the live project converges to
-- the same end state without erroring.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'source_has_location'
      and conrelid = 'public.sources'::regclass
  ) then
    alter table public.sources drop constraint source_has_location;
  end if;
end $$;

alter table public.sources add constraint source_has_location check (
  (source_type = 'youtube' and source_url is not null)
  or (source_type in ('audio', 'video') and storage_path is not null)
  or (source_type = 'transcript' and (storage_path is not null or source_url is not null))
);