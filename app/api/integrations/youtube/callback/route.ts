import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appBaseUrl,
  exchangeCodeForTokens,
  GoogleOAuthError,
  youtubeOAuthRedirectUri
} from "@/lib/youtube/oauth";
import { fetchMyChannel } from "@/lib/youtube/client";
import { saveConnection } from "@/lib/youtube/connections";
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
    res.cookies.delete("yt_oauth_state");
    return res;
  };

  if (denied) return redirect("/upload?youtube=denied");
  if (!user) {
    return redirect(`/login?next=/upload&message=Connect-YouTube-after-login`);
  }
  const expected = request.cookies.get("yt_oauth_state")?.value;
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    log.warn("youtube.callback_state_mismatch", { user_id: user.id });
    return redirect("/upload?youtube=error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code, youtubeOAuthRedirectUri(request));
    const channel = await fetchMyChannel(tokens.access_token);
    await saveConnection(user.id, tokens, channel);
    log.info("youtube.connected", { user_id: user.id, channel_id: channel.channelId });
    return redirect("/upload?youtube=connected");
  } catch (err) {
    if (err instanceof GoogleOAuthError && err.code === "config_missing") {
      log.error("youtube.callback_config_missing", err, { user_id: user.id });
      return redirect("/upload?youtube=config");
    }
    log.error("youtube.callback_failed", err, { user_id: user.id });
    return redirect("/upload?youtube=error");
  }
}