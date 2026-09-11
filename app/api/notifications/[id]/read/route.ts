import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

// Matches PostgREST errors for a missing function: pg-meta's "Could not find
// the function ... in the schema cache" and raw Postgres' "function ... does
// not exist" (code 42883 → PGRST205). Mirrors the prompts route's 503 style.
const RPC_MISSING_PATTERN = /could not find the function|PGRST205|does not exist/i;

const MIGRATION_HINT =
  "Notifications are not available yet — the notifications migration has not been applied.";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: "Missing notification id" }, { status: 400 });

  // Non-UUID ids are rejected as "not found" BEFORE the RPC — same
  // indistinguishable posture as a row the user doesn't own, so existence is
  // never leaked. A malformed id would otherwise surface as a PostgREST/RPC
  // 500 (the RPC's p_id parameter is typed uuid).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  // notifications_mark_read isn't in the handwritten types/supabase.ts
  // Functions map yet — cast just the rpc surface so the call typechecks
  // without widening the client. The RPC is security-definer and checks
  // ownership in-body, so the user (RLS) client is the right one to call it.
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: "notifications_mark_read",
      args: { p_id: string }
    ) => Promise<{ data: boolean | null; error: { message: string; code?: string } | null }>;
  };

  const { data, error } = await rpcClient.rpc("notifications_mark_read", { p_id: id });

  if (error) {
    if (RPC_MISSING_PATTERN.test(error.message)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
    }
    log.error("notifications.mark_read_failed", error, { notification_id: id });
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }

  // false = the RPC found no row owned by this user (missing or someone else's
  // — deliberately not distinguished, so we don't leak existence).
  if (data === false) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}