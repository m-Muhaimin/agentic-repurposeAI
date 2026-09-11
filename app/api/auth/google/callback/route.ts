import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForIdToken, GoogleOAuthError, googleAuthRedirectUri } from "@/lib/google/auth";
import { log } from "@/lib/logger";

interface GoogleAuthState {
  state: string;
  nonce: string;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function readState(cookie: string | undefined): GoogleAuthState | null {
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(cookie) as GoogleAuthState;
    if (typeof parsed.state !== "string" || typeof parsed.nonce !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient();

  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const redirect = (target: string) => {
    const res = NextResponse.redirect(new URL(target, base));
    res.cookies.delete("google_auth_state");
    return res;
  };

  // Consent screen cancelled by the user.
  if (denied) return redirect("/login?google=denied&reason=denied");

  const stored = readState(request.cookies.get("google_auth_state")?.value);
  if (!code || !state || !stored || !safeEqual(state, stored.state)) {
    log.warn("auth.google.callback_state_mismatch");
    return redirect("/login?google=error&reason=state");
  }

  try {
    const { id_token } = await exchangeCodeForIdToken(code, googleAuthRedirectUri(request));

    // Supabase verifies the id_token (including its nonce claim) and mints a
    // session, which the cookie adapter persists onto this response. The user
    // is auto-created server-side by the verify call.
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: id_token,
      nonce: stored.nonce
    });
    if (error) throw error;

    log.info("auth.google.signed_in");
    return redirect("/dashboard");
  } catch (err) {
    if (err instanceof GoogleOAuthError && err.code === "config_missing") {
      log.error("auth.google.callback_config_missing", err);
      return redirect("/login?google=error&reason=config");
    }
    log.error("auth.google.callback_failed", err);
    return redirect("/login?google=error&reason=failed");
  }
}