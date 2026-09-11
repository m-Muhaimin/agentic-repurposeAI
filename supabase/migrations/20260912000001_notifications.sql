-- In-app notifications (Phase 2 of the notification system).
--
-- `notifications` is the durable source of truth for the in-app notification
-- system. Rows are created ONLY server-side via the service role — the browser
-- gets a single SELECT policy scoped to auth.uid() and may mutate read-state
-- solely through the two security-definer RPCs below
-- (notifications_mark_read / notifications_mark_all_read). There is no
-- client INSERT/UPDATE/DELETE path and deliberately no server-side-insert RPC
-- callable by clients.
--
-- The table is added to the supabase_realtime publication so the client can
-- subscribe to postgres_changes filtered by its own user_id (RLS protects the
-- stream: a subscriber only ever sees rows where auth.uid() = user_id).
--
-- Like the other migrations, everything is guarded so this file is safe to run
-- via the Supabase SQL editor against the live project AND in `supabase db
-- push` (idempotent re-run is a no-op).

-- ── Notifications: per-user rows, service-role write, per-user read ────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  entity_type text,
  entity_id text,
  action_url text,
  metadata jsonb,
  dedupe_key text,
  expires_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- Dedupe is opt-in: NULL dedupe_keys never conflict (NULLs are distinct in
  -- Postgres), so rows that don't participate in dedupe are unaffected.
  -- Dedupe scope is per-user: unique (user_id, dedupe_key) — keys are NOT
  -- globally unique (e.g. usage window labels repeat across every tenant), so
  -- the user_id arm prevents one user's key from swallowing another's row.
  unique (user_id, dedupe_key)
);

alter table public.notifications enable row level security;

-- Clients may READ their own rows only. No insert/update/delete policies
-- exist by design — those paths are service-role-only (or the RPCs below).
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'Users can view their own notifications'
  ) then
    create policy "Users can view their own notifications"
      on public.notifications for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Timeline order for the dashboard + unread counts without scanning read rows.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- ── Read-state RPCs (security definer, caller-scoped via auth.uid()) ───────
-- The ONLY client-permitted mutations: mark-read scoped to the caller's own
-- rows, verified server-side. Mirror enqueue_job conventions: plpgsql,
-- search_path pinned to public, EXECUTE revoked from PUBLIC and granted only
-- to authenticated (never anon). The RPCs are security definer so the update
-- runs with table-owner privileges regardless of the absence of UPDATE
-- policies; the auth.uid() filter inside keeps them per-user.
create or replace function public.notifications_mark_read(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.notifications
     set read_at = now()
   where id = p_id
     and user_id = auth.uid();
  get diagnostics v_updated = row_count;
  -- true only if the row exists AND belongs to the caller.
  return v_updated > 0;
end;
$$;

create or replace function public.notifications_mark_all_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.notifications_mark_read(uuid) from public;
grant execute on function public.notifications_mark_read(uuid) to authenticated;

revoke all on function public.notifications_mark_all_read() from public;
grant execute on function public.notifications_mark_all_read() to authenticated;

-- ── Realtime delivery ───────────────────────────────────────────────────────
-- Live updates for the dashboard. Guarded so re-running this migration (or
-- having manually added the table already) is a no-op.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;