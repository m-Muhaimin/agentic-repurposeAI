import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { track, EVENTS, type EventName } from "@/lib/analytics/events";

// Thin server-side bridge for client-originated analytics events (draft
// opened/copied, waitlist clicks, save-button clicks). The client can never
// write to the events table itself; it posts here and the server attributes the
// user from the session cookie.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name: unknown = body?.name;
  if (typeof name !== "string" || !(name as string).length) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Allowlist keeps the ledger clean: only names the app explicitly emits.
  const known = new Set<string>(Object.values(EVENTS));
  if (!known.has(name)) return NextResponse.json({ error: "Unknown event" }, { status: 400 });

  const properties = body?.properties;
  await track(name as EventName, user.id, properties && typeof properties === "object" ? properties : {});

  return NextResponse.json({ ok: true });
}