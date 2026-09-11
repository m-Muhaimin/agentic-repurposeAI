import crypto from "crypto";
import { NextResponse } from "next/server";
import { buildGoogleAuthAuthorizeUrl, googleAuthRedirectUri } from "@/lib/google/auth";
import { log } from "@/lib/logger";

// Public — the user is not signed in yet. Kicks off the Google consent screen
// for "Sign in with Google". The state+nonce pair is bound to an httpOnly,
// sameSite=Lax cookie so the callback can reject CSRF'd `code` deliveries and
// verify the id_token's nonce claim.
export async function GET(request: Request) {
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");
  const redirectUri = googleAuthRedirectUri(request);
  log.info("auth.google.connect", { redirect_uri: redirectUri });

  const authorizeUrl = buildGoogleAuthAuthorizeUrl({ redirectUri, state, nonce });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("google_auth_state", JSON.stringify({ state, nonce }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600
  });
  return response;
}