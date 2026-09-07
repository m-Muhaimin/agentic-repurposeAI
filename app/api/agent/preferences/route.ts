import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAgentPreferences, ensureAgentPreferences, suggestFromSignals } from "@/lib/agent/memory";
import { AGENT_MODES, type AgentMode } from "@/types/agent";
import { log } from "@/lib/logger";

// GET  /api/agent/preferences   — the user's Stage 2 memory: auto mode, brand
//                                voice fields, and confidence-gated suggestions
//                                derived from their edit signals.
// PUT  /api/agent/preferences    — explicit user edits ONLY (mode + brand voice
//                                fields). Signals are never auto-applied here;
//                                the confirm gate is a separate call.

function isAgentMode(v: unknown): v is AgentMode {
  return typeof v === "string" && (AGENT_MODES as string[]).includes(v);
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prefs = await getAgentPreferences(user.id);
  if (!prefs) {
    return NextResponse.json({
      autoMode: "assist",
      brand: { tone: "", forbiddenPhrases: [], examples: [] },
      suggestions: []
    });
  }

  const suggestions = suggestFromSignals(prefs.editSignals);

  return NextResponse.json({
    autoMode: prefs.autoMode,
    brand: prefs.brand,
    brandSamples: prefs.brandSamples,
    suggestions
  });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  const patch: { auto_mode?: string; brand_tone?: string; brand_forbidden_phrases?: string[]; brand_examples?: string[]; brand_samples?: string | null } = {};

  if (body.autoMode !== undefined) {
    if (!isAgentMode(body.autoMode)) {
      return NextResponse.json({ error: "autoMode must be assist, execute or automate" }, { status: 400 });
    }
    patch.auto_mode = body.autoMode;
  }

  // Brand voice is EXPLICIT — the user edits these fields directly. Only write
  // fields actually present so a partial update doesn't clobber the rest.
  if (typeof body.tone === "string") patch.brand_tone = body.tone;
  if (Array.isArray(body.forbiddenPhrases)) patch.brand_forbidden_phrases = body.forbiddenPhrases.filter((p: unknown) => typeof p === "string");
  if (Array.isArray(body.examples)) patch.brand_examples = body.examples.filter((e: unknown) => typeof e === "string");
  if (body.brandSamples !== undefined && (typeof body.brandSamples === "string" || body.brandSamples === null)) {
    patch.brand_samples = body.brandSamples;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await ensureAgentPreferences(user.id);

  const service = createServiceClient();
  const { error } = await service
    .from("v4_agent_preferences")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    log.error("agent.preferences_update_failed", new Error(error.message), { user_id: user.id });
    return NextResponse.json({ error: "Failed to save preferences." }, { status: 500 });
  }

  log.info("agent.preferences_updated", { user_id: user.id, fields: Object.keys(patch) });
  return NextResponse.json({ ok: true });
}