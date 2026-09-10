-- Buffer MCP + agent-scheduling/metrics columns.
--
-- 1) buffer_connections.api_key — the per-user Buffer API key (from
--    publish.buffer.com/settings/api) that authenticates VervAI's agent to the
--    Buffer MCP connector (mcp.buffer.com/mcp) for scheduling into the queue,
--    reading posts (repurpose-from-post) and pulling post metrics. Just like the
--    OAuth tokens it is AES-GCM encrypted at rest (BUFFER_TOKEN_ENCRYPTION_KEY)
--    before insert; only lib/buffer/connections.ts reads/writes the ciphertext.
--    A row may be api-key-only (OAuth columns carry sentinel values; the manual
--    publish path stays OAuth-gated because publishingChannelsConnected requires
--    a non-blank access_token).
--
-- 2) v4_distribution_jobs.metrics + metrics_refreshed_at — post analytics pulled
--    from Buffer for evaluate-phase feedback on the agent's distribution work.
--    `metrics` is the permissive payload from list_posts includeMetrics;
--    metrics_refreshed_at records the last successful refresh.
--
-- Idempotent via `add column if not exists` so re-applying on the already
-- migrated live project is a no-op (same convention as every migration).

alter table public.buffer_connections
  add column if not exists api_key text;

alter table public.v4_distribution_jobs
  add column if not exists metrics jsonb,
  add column if not exists metrics_refreshed_at timestamptz;