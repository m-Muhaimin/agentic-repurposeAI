import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, bufferOAuthRedirectUri } from "@/lib/buffer/oauth";

// Kicks off the Buffer consent screen. The state is bound to an httpOnly,
// sameSite=Lax cookie so the callback can reject CSRF'd `code` deliveries.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const state = crypto.randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl({
    redirectUri: bufferOAuthRedirectUri(request),
    state
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("buffer_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return response;
}