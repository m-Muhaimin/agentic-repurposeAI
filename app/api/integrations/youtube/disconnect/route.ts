import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteConnection } from "@/lib/youtube/connections";
import { log } from "@/lib/logger";

// Removes the user's YouTube connection (and the encrypted tokens with it).
export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await deleteConnection(user.id);
  log.info("youtube.disconnected", { user_id: user.id });
  return NextResponse.json({ ok: true });
}