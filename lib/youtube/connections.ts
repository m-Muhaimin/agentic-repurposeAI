// Persistence for a user's YouTube connection. The refresh token (and any
// cached access token) is AES-GCM encrypted with YOUTUBE_TOKEN_ENCRYPTION_KEY
// before it hits Postgres — the DB never holds a usable credential. Only this
// module reads/writes the ciphertext.

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { refreshAccessToken, type GoogleTokens } from "./oauth";
import type { YoutubeChannel } from "./client";

// Kept deliberately structural (mirrors the remote `youtube_connections` table)
// rather than wired into types/supabase.ts, which is a handwritten placeholder —
// same pattern as IngestSource in lib/ingestion/types.ts.
interface YoutubeConnectionRow {
  id: string;
  user_id: string;
  channel_id: string;
  channel_title: string;
  uploads_playlist_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface YoutubeConnection extends YoutubeConnectionRow {
  // Decrypted access token (null when it hasn't been cached yet).
  accessToken: string | null;
}

// Refresh early rather than racing the token endpoint on the edge — so a token
// expires 3599s out but is treated as stale 60s before that.
const ACCESS_TOKEN_SKEW_MS = 60 * 1000;

function db() {
  return createServiceClient();
}

export async function getConnection(userId: string): Promise<YoutubeConnection | null> {
  const { data, error } = await db()
    .from("youtube_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as YoutubeConnectionRow;
  return { ...row, accessToken: row.access_token ? decryptSecret(row.access_token) : null };
}

export async function saveConnection(
  userId: string,
  tokens: GoogleTokens,
  channel: YoutubeChannel
): Promise<void> {
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token (offline access not granted).");
  }
  const now = new Date();
  const row: Partial<YoutubeConnectionRow> = {
    user_id: userId,
    channel_id: channel.channelId,
    channel_title: channel.channelTitle,
    uploads_playlist_id: channel.uploadsPlaylistId,
    refresh_token: encryptSecret(tokens.refresh_token),
    access_token: tokens.access_token ? encryptSecret(tokens.access_token) : null,
    access_token_expires_at: tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : null,
    updated_at: now.toISOString()
  };
  const { error } = await db().from("youtube_connections").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save YouTube connection: ${error.message}`);
}

async function applyTokens(userId: string, tokens: GoogleTokens, fallbackRefresh: string): Promise<void> {
  const now = new Date();
  const keepRefresh = tokens.refresh_token ?? fallbackRefresh;
  const update: Partial<YoutubeConnectionRow> = {
    refresh_token: keepRefresh ? encryptSecret(keepRefresh) : undefined,
    access_token: tokens.access_token ? encryptSecret(tokens.access_token) : undefined,
    access_token_expires_at: tokens.expires_in
      ? new Date(now.getTime() + tokens.expires_in * 1000).toISOString()
      : null,
    updated_at: now.toISOString()
  };
  const { error } = await db().from("youtube_connections").update(update).eq("user_id", userId);
  if (error) throw new Error(`Could not cache YouTube access token: ${error.message}`);
}

// Returns a usable (non-expired) access token for the user, refreshing through
// Google when the cached one is missing or stale. Null when the user has no
// connection; throws when the connection exists but Google rejects the refresh
// (e.g. access revoked) or the schema/table isn't applied yet.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;

  if (conn.accessToken && conn.access_token_expires_at) {
    const expiresAt = new Date(conn.access_token_expires_at).getTime();
    if (expiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS) return conn.accessToken;
  }

  const tokens = await refreshAccessToken(conn.refresh_token);
  await applyTokens(userId, tokens, conn.refresh_token);
  return tokens.access_token;
}

export async function deleteConnection(userId: string): Promise<void> {
  const { error } = await db().from("youtube_connections").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not remove YouTube connection: ${error.message}`);
}