// Persistence for a user's Buffer connection. The access/refresh tokens are
// AES-GCM encrypted with BUFFER_TOKEN_ENCRYPTION_KEY (see lib/buffer/crypto.ts)
// before they hit Postgres — the DB never holds a usable credential. Only this
// module reads/writes the ciphertext.

import { decryptSecret, encryptSecret } from "./crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { refreshAccessToken, BufferOAuthError, type BufferTokens } from "./oauth";

// Kept deliberately structural (mirrors the remote `buffer_connections` table)
// rather than wired into types/supabase.ts, which is a handwritten placeholder —
// same pattern as YoutubeConnectionRow in lib/youtube/connections.ts.
// `api_key` is the per-user Buffer API key (publish.buffer.com/settings/api)
// that powers the MCP connector the agent uses for scheduling + metrics +
// repurpose-from-post. It is AES-GCM encrypted at rest like the OAuth tokens.
// A row may carry only the API key (no OAuth): the OAuth columns then hold the
// `react-profile` sentinel values below so the NOT NULL contract stays intact.
interface BufferConnectionRow {
  id: string;
  user_id: string;
  buffer_account_id: string;
  buffer_username: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface BufferConnection extends BufferConnectionRow {
  // Decrypted secrets (server-side only, never logged).
  accessToken: string;
  apiKey: string | null;
}

const API_KEY_ONLY_ACCOUNT_ID = "api-key";
const API_KEY_ONLY_USERNAME = "Buffer API key";

function db() {
  return createServiceClient();
}

export async function getConnection(userId: string): Promise<BufferConnection | null> {
  const { data, error } = await db()
    .from("buffer_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as BufferConnectionRow;
  return {
    ...row,
    // api-key-only rows carry an empty access_token ciphertext — never decrypt
    // a blank string (AES-GCM would throw).
    accessToken: row.access_token ? decryptSecret(row.access_token) : "",
    apiKey: row.api_key ? decryptSecret(row.api_key) : null,
    refresh_token: row.refresh_token ? decryptSecret(row.refresh_token) : null
  };
}

// A Buffer "connection" for manual OAuth publishes needs a real OAuth
// access_token. api-key-only rows don't count (their token is blank).
export function connectionHasOAuth(connection: Pick<BufferConnection, "accessToken">): boolean {
  return Boolean(connection.accessToken);
}

// Resolve a usable access token for a user, refreshing it when Buffer's own
// expiry is about to pass (or has). Refresh is real: the new token pair is
// re-encrypted and persisted via saveConnection. Honest failure modes:
//   - no connection            → null (caller reports NO_BUFFER_CONNECTION);
//   - expired + no refresh_token → the stale token, flagged just:false for the
//                                  caller to try (Buffer may still accept it);
//   - refresh rejected by Buffer → BufferOAuthError (surfaces as job `failed`,
//                                  never silently re-queued or retried).
const REFRESH_SKEW_MS = 60_000;

export async function getFreshAccessToken(userId: string): Promise<{ token: string; refreshed: boolean } | null> {
  const connection = await getConnection(userId);
  if (!connection) return null;
  // An api-key-only row is not an OAuth connection — it cannot drive a manual
  // GraphQL send. Refusing here (rather than returning the blank token) keeps
  // the manual publish path OAuth-gated no matter who calls us.
  if (!connectionHasOAuth(connection)) return null;

  const expiresAt = connection.access_token_expires_at ? Date.parse(connection.access_token_expires_at) : NaN;
  const needsRefresh = Number.isFinite(expiresAt) && expiresAt <= Date.now() + REFRESH_SKEW_MS;
  if (!needsRefresh) return { token: connection.accessToken, refreshed: false };

  if (!connection.refresh_token) {
    return { token: connection.accessToken, refreshed: false };
  }

  const tokens = await refreshAccessToken(connection.refresh_token);
  // Buffer rotates the refresh token on refresh (single-use); the response
  // always carries a fresh one. Guard the shape to never store nulls.
  await saveConnection(userId, tokens, {
    id: connection.buffer_account_id,
    username: connection.buffer_username
  });
  const fresh = await getConnection(userId);
  if (!fresh) {
    throw new BufferOAuthError("Buffer connection could not be re-read after refresh.", "token_refresh_failed");
  }
  return { token: fresh.accessToken, refreshed: true };
}

export async function saveConnection(
  userId: string,
  tokens: BufferTokens,
  user: { id: string; username: string }
): Promise<void> {
  const now = new Date();
  // Preserve an existing api_key ciphertext: connecting OAuth must not wipe the
  // MCP API key a user already configured (and vice-versa is handled separately).
  const existing = await getConnection(userId);
  const row: Partial<BufferConnectionRow> = {
    user_id: userId,
    buffer_account_id: String(user.id),
    buffer_username: user.username,
    access_token: encryptSecret(tokens.access_token),
    refresh_token: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    access_token_expires_at: tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : null,
    api_key: existing?.apiKey ? encryptSecret(existing.apiKey) : existing ? existing.api_key ?? null : null,
    updated_at: now.toISOString()
  };
  const { error } = await db().from("buffer_connections").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save Buffer connection: ${error.message}`);
}

export async function deleteConnection(userId: string): Promise<void> {
  const { error } = await db().from("buffer_connections").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not remove Buffer connection: ${error.message}`);
}

// ── Per-user Buffer API key (MCP connector auth) ─────────────────────────────

// Matches the postgrest "column does not exist" family so read paths degrade to
// null before the 20260910000001 migration lands (same pattern as user_prompts).
const API_KEY_COLUMN_MISSING = /could not find the\s*\w*\s*["']?api_key|does\s*not\s*exist|PGRST205|42P01/i;

export function isApiKeyColumnMissing(err: unknown): boolean {
  return err instanceof Error && API_KEY_COLUMN_MISSING.test(err.message);
}

export async function getApiKey(userId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("buffer_connections")
    .select("api_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && !API_KEY_COLUMN_MISSING.test(error.message)) {
    throw new Error(`Could not read Buffer API key: ${error.message}`);
  }
  if (error || !data || !(data as { api_key?: string | null }).api_key) return null;
  return decryptSecret((data as { api_key: string }).api_key);
}

export async function saveApiKey(userId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("Buffer API key must not be empty.");
  const existing = await getConnection(userId);
  const row: Partial<BufferConnectionRow> = {
    user_id: userId,
    // Sentinel OAuth values keep the NOT NULL contract; they are never used to
    // publish because connectionHasOAuth() sees the blank access_token.
    buffer_account_id: existing?.buffer_account_id ?? API_KEY_ONLY_ACCOUNT_ID,
    buffer_username: existing?.buffer_username ?? API_KEY_ONLY_USERNAME,
    access_token: existing?.accessToken ? encryptSecret(existing.accessToken) : "",
    refresh_token: existing?.refresh_token ? encryptSecret(existing.refresh_token) : null,
    access_token_expires_at: existing?.access_token_expires_at ?? null,
    api_key: encryptSecret(trimmed),
    updated_at: new Date().toISOString()
  };
  const { error } = await db().from("buffer_connections").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save Buffer API key: ${error.message}`);
}

export async function deleteApiKey(userId: string): Promise<void> {
  const { error } = await db().from("buffer_connections").eq("user_id", userId).update({ api_key: null });
  if (error) throw new Error(`Could not remove Buffer API key: ${error.message}`);
}