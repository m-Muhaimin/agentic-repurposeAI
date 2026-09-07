import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appBaseUrl,
  exchangeCodeForTokens,
  fetchBufferUser,
  BufferOAuthError,
  bufferOAuthRedirectUri
} from "@/lib/buffer/oauth";
import { saveConnection } from "@/lib/buffer/connections";
import { log } from "@/lib/logger";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  const base = appBaseUrl(request);
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  const redirect = (target: string) => {
    const res = NextResponse.redirect(new URL(target, base));
    res.cookies.delete("buffer_oauth_state");
    return res;
  };

  if (denied) return redirect("/connections?success=buffer&error=denied");
  if (!user) {
    return redirect(`/login?next=/connections&message=Connect-Buffer-after-login`);
  }
  const expected = request.cookies.get("buffer_oauth_state")?.value;
  let verifier: string | null = null;
  let expectedState: string | null = null;
  if (expected) {
    try {
      const parsed = JSON.parse(expected) as { state?: string; verifier?: string };
      expectedState = parsed.state ?? null;
      verifier = parsed.verifier ?? null;
    } catch {
      // malformed cookie → treated as a mismatch below, no leak.
    }
  }
  if (!code || !state || !expectedState || !verifier || !safeEqual(state, expectedState)) {
    log.warn("buffer.callback_state_mismatch", { user_id: user.id });
    return redirect("/connections?success=buffer&error=state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, bufferOAuthRedirectUri(request), verifier);
    const bufferUser = await fetchBufferUser(tokens.access_token);
    await saveConnection(user.id, tokens, bufferUser);
    log.info("buffer.connected", { user_id: user.id, account_id: bufferUser.id });
    return redirect("/connections?success=buffer");
  } catch (err) {
    if (err instanceof BufferOAuthError && err.code === "config_missing") {
      log.error("buffer.callback_config_missing", err, { user_id: user.id });
      return redirect("/connections?success=buffer&error=config");
    }
    log.error("buffer.callback_failed", err, { user_id: user.id });
    return redirect("/connections?success=buffer&error=failed");
  }
}