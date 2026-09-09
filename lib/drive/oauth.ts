// Google OAuth2 plumbing for the "Connect Google Drive" flow — reuse the same
// Google OAuth client as YouTube (GOOGLE_CLIENT_ID/SECRET) plus the generic
// token exchange/refresh helpers from lib/youtube/oauth.ts. Only the scopes and
// redirect URI differ.
//
// Drive tokens are encrypted at rest by connections.ts exactly like YouTube's.

import {
  appBaseUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  GoogleOAuthError,
  type GoogleTokens
} from "@/lib/youtube/oauth";

export {
  appBaseUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  GoogleOAuthError,
  type GoogleTokens
};

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Read-only access to the user's own Drive files — enough to ingest an
// uploaded document/transcript/audio/video from a Drive URL without ever
// touching write endpoints. No Drive write scopes are requested.
export const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.readonly";

export function driveOAuthRedirectUri(request: Request): string {
  return `${appBaseUrl(request)}/api/integrations/drive/callback`;
}

export function buildDriveAuthorizeUrl(opts: {
  redirectUri: string;
  state: string;
  clientId: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    access_type: "offline", // required for a refresh_token
    prompt: "consent", // re-issue a refresh_token even on repeat connects
    state: opts.state
  });
  return `${AUTH_URL}?${params.toString()}`;
}