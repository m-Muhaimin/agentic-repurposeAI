// Google OAuth for "Sign in with Google" — creates Supabase sessions via
// signInWithIdToken. Shares GOOGLE_CLIENT_ID/SECRET with the YouTube/Drive
// integration flows (lib/youtube/oauth.ts).
//
// Uses OpenID Connect scopes (openid email profile) to obtain an id_token,
// which Supabase verifies server-side to mint a session. No tokens are stored
// by this module — the session lives in the Supabase cookie adapter.

import { appBaseUrl, GoogleOAuthError } from "@/lib/youtube/oauth";

export { appBaseUrl, GoogleOAuthError };

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"].join(" ");

export function googleAuthRedirectUri(request: Request): string {
  return `${appBaseUrl(request)}/api/auth/google/callback`;
}

export function buildGoogleAuthAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleOAuthError("Google OAuth is not configured.", "config_missing");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_AUTH_SCOPES,
    state: opts.state,
    nonce: opts.nonce,
    prompt: "select_account"
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForIdToken(
  code: string,
  redirectUri: string
): Promise<{ id_token: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleOAuthError("Google OAuth is not configured.", "config_missing");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errCode = typeof data.error === "string" ? data.error : "token_error";
    const message =
      (typeof data.error_description === "string" && data.error_description) ||
      (typeof data.error === "string" && data.error) ||
      `Token request failed (${res.status}).`;
    throw new GoogleOAuthError(message, errCode);
  }
  if (typeof data.id_token !== "string" || !data.id_token) {
    throw new GoogleOAuthError("Google did not return an id_token.", "missing_id_token");
  }
  return { id_token: data.id_token };
}
