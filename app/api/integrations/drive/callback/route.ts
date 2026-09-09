import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appBaseUrl,
  exchangeCodeForTokens,
  GoogleOAuthError,
  driveOAuthRedirectUri
} from "@/lib/drive/oauth";
import { fetchDriveAccount } from "@/lib/drive/client";
import { saveConnection } from "@/lib/drive/connections";
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
    res.cookies.delete("gd_oauth_state");
    return res;
  };

  if (denied) return redirect("/connections?success=drive&error=denied");
  if (!user) {
    return redirect(`/login?next=/connections&message=Connect-Drive-after-login`);
  }
  const expected = request.cookies.get("gd_oauth_state")?.value;
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    log.warn("drive.callback_state_mismatch", { user_id: user.id });
    return redirect("/connections?success=drive&error=state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, driveOAuthRedirectUri(request));
    const account = await fetchDriveAccount(tokens.access_token);
    await saveConnection(user.id, tokens, account);
    log.info("drive.connected", { user_id: user.id, email: account.email });
    return redirect("/connections?success=drive");
  } catch (err) {
    if (err instanceof GoogleOAuthError && err.code === "config_missing") {
      log.error("drive.callback_config_missing", err, { user_id: user.id });
      return redirect("/connections?success=drive&error=config");
    }
    log.error("drive.callback_failed", err, { user_id: user.id });
    return redirect("/connections?success=drive&error=failed");
  }
}