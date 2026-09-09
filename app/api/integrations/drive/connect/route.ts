import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDriveAuthorizeUrl, driveOAuthRedirectUri } from "@/lib/drive/oauth";

// Kicks off the Google consent screen for Drive. The state is bound to an
// httpOnly, sameSite=Lax cookie so the callback can reject CSRF'd `code`
// deliveries (same pattern as the YouTube/Buffer connect routes).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authorizeUrl = buildDriveAuthorizeUrl({
    redirectUri: driveOAuthRedirectUri(request),
    state,
    clientId: process.env.GOOGLE_CLIENT_ID
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("gd_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return response;
}