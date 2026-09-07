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
interface BufferConnectionRow {
  id: string;
  user_id: string;
  buffer_account_id: string;
  buffer_username: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BufferConnection extends BufferConnectionRow {
  // Decrypted access token (server-side only, never logged).
  accessToken: string;
}

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
    accessToken: decryptSecret(row.access_token),
    refresh_token: row.refresh_token ? decryptSecret(row.refresh_token) : null
  };
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
  const row: Partial<BufferConnectionRow> = {
    user_id: userId,
    buffer_account_id: String(user.id),
    buffer_username: user.username,
    access_token: encryptSecret(tokens.access_token),
    refresh_token: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
    access_token_expires_at: tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : null,
    updated_at: now.toISOString()
  };
  const { error } = await db().from("buffer_connections").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save Buffer connection: ${error.message}`);
}

export async function deleteConnection(userId: string): Promise<void> {
  const { error } = await db().from("buffer_connections").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not remove Buffer connection: ${error.message}`);
}