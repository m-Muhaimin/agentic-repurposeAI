-- Widen the `outputs.format` CHECK constraint and `jobs.formats` default to
-- include the two new first-class output-registry formats: `thread` and
-- `carousel`. Content for both is a single text blob (numbered posts / slide
-- separators), so no column changes are needed — only the accepted value sets.
--
-- Idempotent: the CHECK is dropped with `if exists` then re-added with the
-- widened list, so re-applying on an already-migrated project is a no-op
-- (same convention as every migration).

alter table public.outputs
  drop constraint if exists outputs_format_check;

alter table public.outputs
  add constraint outputs_format_check
  check (format in ('linkedin_post', 'newsletter', 'shortform_script', 'thread', 'carousel'));

-- The jobs default is a DDL default, not a named constraint — replacing it is
-- itself idempotent (`set default` overwrites).
alter table public.jobs
  alter column formats set default array['linkedin_post', 'newsletter', 'shortform_script', 'thread', 'carousel']::text[];