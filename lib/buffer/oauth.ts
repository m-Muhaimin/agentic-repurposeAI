// Buffer OAuth2 plumbing for the "Connect Buffer" flow — no SDK, a handful of
// fetch calls. The callback route is the ONLY place a code is ever exchanged,
// the client secret never leaves the server, and refresh tokens never reach the
// browser or the client bundle (they're encrypted at rest by connections.ts).
//
// Buffer's OAuth2 is standard code-in-query / token-in-query: authorize at
// buffer.com, exchange at api.bufferapp.com, and identity at /1/user.json. The
// access_token is passed as a query param by the API surface, so it must be kept
// short-lived and only ever held on the server.

const AUTH_URL = "https://buffer.com/oauth2/authorize";
const TOKEN_URL = "https://api.bufferapp.com/1/oauth2/token.json";
const USER_URL = "https://api.bufferapp.com/1/user.json";

// Read the account (to stamp the connection) and write posts. `posts:write` is
// the publish capability; we only request what the queue actually uses.
export const BUFFER_SCOPES = ["account:read", "posts:read", "posts:write"].join(" ");

export interface BufferTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface BufferUser {
  id: number;
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

export function buildAuthorizeUrl(opts: { redirectUri: string; state: string }): string {
  const { id } = clientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: BUFFER_SCOPES,
    state: opts.state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<BufferTokens> {
  const { id, secret } = clientCredentials();
  const body = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
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

// Fetch the Buffer account identity so we can stamp the connection row. The
// access token is a query param (Buffer's API surface), kept server-side only.
export async function fetchBufferUser(accessToken: string): Promise<BufferUser> {
  const res = await fetch(`${USER_URL}?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) {
    throw new BufferOAuthError(`Buffer user fetch failed (${res.status}).`, "user_fetch_failed");
  }
  const json = (await res.json()) as BufferUser;
  if (!json.id || !json.username) {
    throw new BufferOAuthError("Buffer user response was missing identity fields.", "user_fetch_failed");
  }
  return { id: json.id, username: json.username };
}