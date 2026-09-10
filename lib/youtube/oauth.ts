// Google OAuth2 plumbing for the "Connect YouTube" flow — no SDK, a handful of
// fetch calls. The callback route is the ONLY place a code is ever exchanged,
// the client secret never leaves the server, and refresh tokens never reach the
// browser or the client bundle (they're encrypted at rest by connections.ts).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Reading the connected user's own videos and caption tracks. `youtube.readonly`
// alone covers channels/videos/playlistItems; captions.list/download accept both
// `youtube.readonly` and `youtube.force-ssl`, so request both to be safe across
// the endpoints this feature uses.
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl"
].join(" ");

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class GoogleOAuthError extends Error {
  code: string;
  constructor(message: string, code = "google_error") {
    super(message);
    this.name = "GoogleOAuthError";
    this.code = code;
  }
}

function clientCredentials(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new GoogleOAuthError("Google OAuth is not configured.", "config_missing");
  }
  return { id, secret };
}

// Origin used for OAuth redirects and post-flow navigation. In production this
// should be pinned via NEXT_PUBLIC_APP_URL so the redirect_uri never shifts with
// an incoming Host header; locally it falls back to the request origin (which
// must itself be registered as a redirect URI in the Google Cloud console).
export function appBaseUrl(request: Request): string {
  // Normalize away a trailing slash in NEXT_PUBLIC_APP_URL: the redirect URI is
  // built by path-splicing, and Google matches redirect_uri exactly against the
  // registered URI — a stray "/" makes every OAuth connect fail.
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/+$/, "");
}

export function youtubeOAuthRedirectUri(request: Request): string {
  return `${appBaseUrl(request)}/api/integrations/youtube/callback`;
}

export function buildAuthorizeUrl(opts: { redirectUri: string; state: string }): string {
  const { id } = clientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES,
    access_type: "offline", // required for a refresh_token
    prompt: "consent", // re-issue a refresh_token even on repeat connects
    state: opts.state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const { id, secret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body })
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // Google errors are JSON: { error: "invalid_grant", error_description: "..." }
    const code = typeof data.error === "string" ? data.error : "token_error";
    const message =
      (typeof data.error_description === "string" && data.error_description) ||
      (typeof data.error === "string" && data.error) ||
      `Token request failed (${res.status}).`;
    throw new GoogleOAuthError(message, code);
  }
  return data as unknown as GoogleTokens;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}