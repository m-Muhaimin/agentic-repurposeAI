-- Stage 4 (BYOB): Buffer publishing connection storage.
--
-- One row per user: encrypted Buffer OAuth tokens plus the Buffer account stamp
-- (account id + username) so the publish queue and the distribution tool can do
-- a real "is a channel connected" check and resolve profiles without asking the
-- user again. Tokens are AES-GCM encrypted with BUFFER_TOKEN_ENCRYPTION_KEY
-- before insert; ciphertext is invisible to clients and plaintext is never
-- stored or logged.
--
-- Idempotent (table/column/policy guards) so it can be re-applied on the live
-- project exactly like migrations 0005/0006.

create table if not exists public.buffer_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buffer_account_id text not null,
  buffer_username text not null,
  access_token text not null,
  refresh_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.buffer_connections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'buffer_connections' and policyname = 'Users can view their own Buffer connection'
  ) then
    create policy "Users can view their own Buffer connection"
      on public.buffer_connections for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'buffer_connections' and policyname = 'Users can insert their own Buffer connection'
  ) then
    create policy "Users can insert their own Buffer connection"
      on public.buffer_connections for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'buffer_connections' and policyname = 'Users can update their own Buffer connection'
  ) then
    create policy "Users can update their own Buffer connection"
      on public.buffer_connections for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'buffer_connections' and policyname = 'Users can delete their own Buffer connection'
  ) then
    create policy "Users can delete their own Buffer connection"
      on public.buffer_connections for delete
      using (auth.uid() = user_id);
  end if;
end $$;