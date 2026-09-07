import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection } from "@/lib/youtube/connections";

// Connection status for the upload page (channel name only — tokens never leave
// the server, and this route never returns them).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const conn = await getConnection(user.id);
  return NextResponse.json({
    connected: !!conn,
    channelId: conn?.channel_id ?? null,
    channelTitle: conn?.channel_title ?? null
  });
}