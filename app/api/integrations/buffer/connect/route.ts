import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAuthorizeUrl,
  bufferOAuthRedirectUri,
  generatePkceVerifier,
  generatePkceChallenge
} from "@/lib/buffer/oauth";

// Kicks off the Buffer consent screen. The state AND the PKCE code_verifier are
// bound to an httpOnly, sameSite=Lax cookie so the callback can reject CSRF'd
// `code` deliveries and is the ONLY holder of the verifier needed to exchange
// the code for tokens. Buffer's OAuth (auth.buffer.com) requires PKCE (S256);
// without the verifier challenge/verifier pair the code cannot be traded.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const state = crypto.randomBytes(16).toString("hex");
  const verifier = generatePkceVerifier();
  const codeChallenge = generatePkceChallenge(verifier);
  const authorizeUrl = buildAuthorizeUrl({
    redirectUri: bufferOAuthRedirectUri(request),
    state,
    codeChallenge
  });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("buffer_oauth_state", JSON.stringify({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return response;
}