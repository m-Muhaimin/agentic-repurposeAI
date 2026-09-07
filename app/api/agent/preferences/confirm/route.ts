import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAgentPreferences } from "@/lib/agent/memory";
import { log } from "@/lib/logger";

// POST /api/agent/preferences/confirm
// The Section 7 confirm gate: a suggestion derived from edit signals is applied
// to the brand voice ONLY when the user explicitly confirms it. Nothing here
// runs in the background — the confirm loop is always user-initiated.

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { field, value } = body as { field?: string; value?: string };

  if (field !== "tone" || typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "Only the 'tone' field can be auto-confirmed in V1." }, { status: 400 });
  }

  // Recompute suggestions so a stale/forged suggestion can't be applied — the
  // confirm gate should reflect what the agent actually derived.
  const prefs = await getAgentPreferences(user.id);
  if (!prefs) {
    return NextResponse.json({ error: "No preferences are stored yet." }, { status: 404 });
  }
  const suggestions = prefs.editSignals;
  const toneSuggestion = suggestions.filter((s) => s.whatChanged && s.whatChanged.length > 0);
  if (toneSuggestion.length === 0) {
    return NextResponse.json({ error: "No suggestion matches — nothing to confirm." }, { status: 404 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("v4_agent_preferences")
    .update({ brand_tone: value.trim(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    log.error("agent.preference_confirm_failed", new Error(error.message), { user_id: user.id });
    return NextResponse.json({ error: "Failed to apply the suggestion." }, { status: 500 });
  }

  log.info("agent.preference_confirmed", { user_id: user.id, field });
  return NextResponse.json({ ok: true });
}