import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { youtubeOAuthRedirectUri, appBaseUrl as youtubeAppBaseUrl } from "@/lib/youtube/oauth";
import { driveOAuthRedirectUri } from "@/lib/drive/oauth";
import { bufferOAuthRedirectUri } from "@/lib/buffer/oauth";

// OAuth integration diagnostics — answers "what redirect_uri is the app really
// sending, and is it registered?" after a `redirect_uri_mismatch` error.
//
// Google/Buffer match redirect_uri EXACTLY (no trailing slash, exact port/scheme
// and host) against the URIs registered in the Google Cloud / Buffer app
// console. This route prints the exact strings to register, plus the effective
// base-origin resolution so a stale NEXT_PUBLIC_APP_URL is obvious. It returns
// configuration presence only — never secrets.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const google = {
    clientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    clientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET)
  };
  const buffer = {
    clientId: Boolean(process.env.BUFFER_CLIENT_ID),
    clientSecret: Boolean(process.env.BUFFER_CLIENT_SECRET),
    encryptionKey: Boolean(process.env.BUFFER_TOKEN_ENCRYPTION_KEY)
  };

  return NextResponse.json({
    env: {
      nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? null,
      requestOrigin: new URL(request.url).origin,
      effectiveBase: youtubeAppBaseUrl(request)
    },
    google,
    buffer: {
      ...buffer,
      youtubeEncryptionKey: Boolean(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY)
    },
    redirectUris: {
      youtube: youtubeOAuthRedirectUri(request),
      drive: driveOAuthRedirectUri(request),
      buffer: bufferOAuthRedirectUri(request)
    },
    hint: [
      "Register each redirectUri EXACTLY as printed (no trailing slash) under the matching provider console:",
      "youtube + drive live on the same Google Cloud OAuth client (GOOGLE_CLIENT_ID) — the youtube AND drive callback paths are separate entries.",
      "buffer lives on the Buffer app console (BUFFER_CLIENT_ID).",
      "redirect_uri_mismatch almost always means a registered URI differs (origin, port, scheme http/https, or a trailing slash) — or NEXT_PUBLIC_APP_URL is a localhost leftover reaching a public request."
    ].join(" ")
  });
}