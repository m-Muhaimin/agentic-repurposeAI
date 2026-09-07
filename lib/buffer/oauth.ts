// Buffer OAuth2 plumbing for the "Connect Buffer" flow — no SDK, a handful of
// fetch calls. The callback route is the ONLY place a code is ever exchanged,
// the client secret never leaves the server, and refresh tokens never reach the
// browser or the client bundle (they're encrypted at rest by connections.ts).
//
// Buffer's current OAuth2 (replacing the legacy Buffer-app REST OAuth) lives at
// auth.buffer.com and REQUIRES the Authorization Code + PKCE (S256) flow:
//   authorise  https://auth.buffer.com/auth                (+pkce challenge, prompt=consent)
//   exchange   https://auth.buffer.com/token               (+code_verifier)
//   identity   https://api.buffer.com                      (GraphQL `account` query)
// Access tokens are Bearer tokens sent in an Authorization header (never a query
// param) — kept short-lived and held only on the server. `offline_access` is
// mandatory to receive a refresh token at all; without it the token dies after
// expires_in and the user must re-authorize.

import crypto from "crypto";

const AUTH_URL = "https://auth.buffer.com/auth";
const TOKEN_URL = "https://auth.buffer.com/token";
const GRAPHQL_URL = "https://api.buffer.com";

// Read the account (to stamp the connection) and write posts. `offline_access`
// is what makes a long-lived refresh token come back in the token response.
export const BUFFER_SCOPES = ["account:read", "posts:read", "posts:write", "offline_access"].join(" ");

export interface BufferTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// GraphQL `account.id` is a string (the legacy numeric id is gone); `username`
// is synthesized from the account's email/name so connection rows keep the
// same display shape.
export interface BufferUser {
  id: string;
  username: string;
}

export class BufferOAuthError extends Error {
  code: string;
  constructor(message: string, code = "buffer_error") {
    super(message);
    this.name = "BufferOAuthError";
    this.code = code;
  }
}

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.BUFFER_CLIENT_ID?.trim();
  const secret = process.env.BUFFER_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    throw new BufferOAuthError("Buffer OAuth is not configured.", "config_missing");
  }
  return { id, secret };
}

// PKCE (RFC 7636): a random 32-byte verifier and its base64url SHA-256 challenge.
// The verifier is stored server-side in the oauth state cookie (httpOnly) so only
// the callback that started the flow can trade the code for tokens.
function base64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function generatePkceVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generatePkceChallenge(verifier: string): string {
  return base64Url(crypto.createHash("sha256").update(verifier).digest());
}

// Origin used for OAuth redirects and post-flow navigation. Pinned via
// NEXT_PUBLIC_APP_URL in production so the redirect_uri never shifts with an
// incoming Host header; locally it falls back to the request origin (which must
// itself be registered as a redirect URI in the Buffer app console).
export function appBaseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export function bufferOAuthRedirectUri(request: Request): string {
  return `${appBaseUrl(request)}/api/integrations/buffer/callback`;
}

export function buildAuthorizeUrl(opts: { redirectUri: string; state: string; codeChallenge: string }): string {
  const { id } = clientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: BUFFER_SCOPES,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent"
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string, codeVerifier: string): Promise<BufferTokens> {
  const { id, secret } = clientCredentials();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new BufferOAuthError(`Buffer token exchange failed (${res.status}).`, "token_exchange_failed");
  }
  const json = (await res.json()) as BufferTokens;
  if (!json.access_token) {
    throw new BufferOAuthError("Buffer did not return an access token.", "token_exchange_failed");
  }
  return json;
}

// Rotate a stored refresh token for a fresh access token (grant_type
// refresh_token). Called by connections.ts when access_token_expires_at
// is about to pass — never from the client bundle. A failure here is
// surfaced honestly (job `failed` / stale-token error), never retried.
//
// NOTE: Buffer refresh tokens are SINGLE-USE. Every successful refresh returns a
// NEW refresh_token and invalidates the one that was just used. connections.ts
// persists the rotated pair, so the stored one is never replayed.
export async function refreshAccessToken(refreshToken: string): Promise<BufferTokens> {
  const { id, secret } = clientCredentials();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new BufferOAuthError(`Buffer token refresh failed (${res.status}).`, "token_refresh_failed");
  }
  const json = (await res.json()) as BufferTokens;
  if (!json.access_token) {
    throw new BufferOAuthError("Buffer did not return an access token on refresh.", "token_refresh_failed");
  }
  return json;
}

// Fetch the Buffer account identity via the GraphQL API so we can stamp the
// connection row. Access token rides in the Authorization header.
export async function fetchBufferUser(accessToken: string): Promise<BufferUser> {
  const query = `query { account { id email name } }`;
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    throw new BufferOAuthError(`Buffer user fetch failed (${res.status}).`, "user_fetch_failed");
  }
  const json = (await res.json()) as {
    data?: { account?: { id?: string; email?: string; name?: string } };
    errors?: { message?: string }[];
  };
  const account = json.data?.account;
  if (!account?.id) {
    const detail = json.errors?.[0]?.message;
    throw new BufferOAuthError(
      `Buffer user response was missing identity fields.${detail ? ` ${detail}` : ""}`,
      "user_fetch_failed"
    );
  }
  return { id: account.id, username: account.email || account.name || account.id };
}