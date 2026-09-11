// Google OAuth2 plumbing for the "Connect YouTube" flow — no SDK, a handful of
// fetch calls. The callback route is the ONLY place a code is ever exchanged,
// the client secret never leaves the server, and refresh tokens never reach the
// browser or the client bundle (they're encrypted at rest by connections.ts).

import { log } from "@/lib/logger";

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

// "Private" hostnames (localhost, LAN IPs) that can never be the deployed
// origin — used to detect a dev-leftover NEXT_PUBLIC_APP_URL reaching prod.
function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  const octets = h.split(".").map(Number);
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

// Origin used for OAuth redirects and post-flow navigation. NEXT_PUBLIC_APP_URL
// pins the production origin so the redirect_uri never shifts with an incoming
// Host header; locally it falls back to the request origin. Because Google and
// Buffer match redirect_uri EXACTLY against the registered URI, a stray
// trailing slash is normalized away — and a private/localhost pin that is
// clearly a dev leftover (reaching a public request) is ignored in favor of the
// real request origin, which is the #1 cause of `redirect_uri_mismatch`.
export function appBaseUrl(request: Request): string {
  const requestOrigin = new URL(request.url).origin.replace(/\/+$/, "");
  const pinned = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (!pinned) return requestOrigin;
  try {
    const pinnedHost = new URL(pinned).hostname;
    const requestHost = new URL(requestOrigin).hostname;
    if (isPrivateHostname(pinnedHost) && !isPrivateHostname(requestHost)) {
      // A localhost/private pin reaching a public request is a dev leftover
      // copied into prod env. Trusting it would send the provider a redirect_uri
      // no console has registered → redirect_uri_mismatch. Use the real origin.
      log.warn("google.oauth.local_pin_ignored", { pinned, requestOrigin });
      return requestOrigin;
    }
  } catch {
    // Unparseable pin (no scheme) — never build a redirect URI from it.
    return requestOrigin;
  }
  return pinned;
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