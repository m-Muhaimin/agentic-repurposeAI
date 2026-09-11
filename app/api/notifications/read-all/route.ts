import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

// Matches PostgREST errors for a missing function: pg-meta's "Could not find
// the function ... in the schema cache" and raw Postgres' "function ... does
// not exist" (code 42883 → PGRST205). Mirrors the prompts route's 503 style.
const RPC_MISSING_PATTERN = /could not find the function|PGRST205|does not exist/i;

const MIGRATION_HINT =
  "Notifications are not available yet — the notifications migration has not been applied.";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // notifications_mark_all_read isn't in the handwritten types/supabase.ts
  // Functions map yet — cast just the rpc surface so the call typechecks
  // without widening the client. The RPC is security-definer and scoped to the
  // caller's own rows in-body, so the user (RLS) client is the right one.
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: "notifications_mark_all_read",
      args?: Record<string, never>
    ) => Promise<{ data: number | null; error: { message: string; code?: string } | null }>;
  };

  const { data, error } = await rpcClient.rpc("notifications_mark_all_read");

  if (error) {
    if (RPC_MISSING_PATTERN.test(error.message)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
    }
    log.error("notifications.mark_all_read_failed", error);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marked: typeof data === "number" ? data : null });
}