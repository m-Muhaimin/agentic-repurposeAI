import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUploads } from "@/lib/youtube/client";
import { getConnection, getValidAccessToken } from "@/lib/youtube/connections";
import { log } from "@/lib/logger";

// The connected user's most recent uploads, for the "Repurpose one of mine"
// picker on the upload page.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const conn = await getConnection(user.id);
  if (!conn) {
    return NextResponse.json({ error: "YouTube is not connected." }, { status: 400 });
  }

  let accessToken: string;
  try {
    const token = await getValidAccessToken(user.id);
    if (!token) throw new Error("No access token.");
    accessToken = token;
  } catch (err) {
    log.warn("youtube.videos_token_failed", {
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json({ error: "YouTube access expired — reconnect your channel." }, { status: 502 });
  }

  try {
    const videos = await fetchUploads(accessToken, conn.uploads_playlist_id, 25);
    return NextResponse.json({ videos });
  } catch (err) {
    log.warn("youtube.videos_fetch_failed", {
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json({ error: "Could not fetch your videos." }, { status: 502 });
  }
}