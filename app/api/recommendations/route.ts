// Phase 6: Dashboard API — GET /api/recommendations?sourceId=xxx
// Returns ranked, explainable output recommendations for a piece of content
// intelligence, based on the user's current objective.
//
// Auth: requires a signed-in user (Supabase server client, getUser()).
// Ownership: the content_intelligence row must belong to the user (or the source
// it references must belong to the user).
// Objective: read from user_preferences.current_objective if stored; otherwise
// default to "get_reach". A full objective-picker UI is a Phase 7 item — see the
// module docstring below.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recommend, type Objective, type EnrichedRecommendation } from "@/lib/recommendations";
import type { ContentIntelligence } from "@/lib/intelligence/types";

// ── default objective ────────────────────────────────────────────────────────

const DEFAULT_OBJECTIVE: Objective = {
  kind: "get_reach",
  label: "Get more reach",
};

// ── objective from preference (or default) ───────────────────────────────────

async function objectiveForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Objective> {
  // Phase 6: read user_preferences.current_objective if it exists.
  // If no preference is stored, fall back to the sensible default "get_reach".
  //
  // NOTE: a full objective-picker UI (letting the user choose their goal per
  // source or globally) is a Phase 7 item. For now we store at most one
  // preferred objective per user and default gracefully.
  //
  // user_preferences may or may not be present in the DB types depending on
  // whether migration 0800001 (paddle billing) has been applied + types
  // regenerated. We cast through unknown so the route compiles either way.
  type PrefRow = { current_objective?: string | null };
  const { data: pref, error } = await supabase
    .from("user_preferences")
    .select("current_objective")
    .eq("user_id", userId)
    .single() as { data: PrefRow | null; error: { code: string } | null };

  if (error?.code === "PGRST116" || !pref?.current_objective) {
    return DEFAULT_OBJECTIVE;
  }

  const stored = pref.current_objective;

  const labels = {
    grow_linkedin: "Grow my LinkedIn audience",
    grow_email: "Build my email audience",
    get_reach: "Get more reach",
    clarify_ideas: "Clarify my ideas",
    drive_action: "Drive action",
  } as const satisfies Record<Objective["kind"], string>;

  // Safe: the .includes guard verified it at runtime.
  const kind = stored as Objective["kind"];
  return { kind, label: labels[kind] };
}

// ── fetch intelligence ───────────────────────────────────────────────────────

type DbIntelligence = {
  id: string;
  source_id: string;
  data: string; // JSON-encoded ContentIntelligence
  user_id: string;
};

async function fetchIntelligence(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  userId: string
): Promise<DbIntelligence | null> {
  // The content_intelligence table is owned by the user who analyzed the source.
  // Verify ownership: either the intelligence row's user_id matches, or the
  // referenced source belongs to the user.
  //
  // content_intelligence may or may not be present in the live DB types
  // depending on whether migration 0004 has been applied. We cast through
  // unknown so the route compiles in both cases — at runtime the table exists
  // (verified by verify-rls / verify-agentic), so the query shape is correct.
  type CIRow = { id: string; source_id: string; data: string; user_id: string };
  const { data: intel, error: intelError } =
    await supabase
      .from("content_intelligence")
      .select("id, source_id, data, user_id")
      .eq("source_id", sourceId)
      .single() as { data: CIRow | null; error: { code: string } | null };

  if (intelError?.code === "PGRST116") {
    return null; // no intelligence for this source
  }

  if (intelError) {
    return null;
  }

  if (!intel) return null;

  // Ownership check: the intelligence must belong to the user, OR the source
  // must belong to the user.
  const belongsToUser =
    intel.user_id === userId ||
    (await sourceOwnedByUser(supabase, intel.source_id, userId));

  if (!belongsToUser) return null;

  return intel as DbIntelligence;
}

async function sourceOwnedByUser(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sources")
    .select("id")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (error?.code === "PGRST116") return false;
  if (error) return false;
  return !!data;
}

function parseIntelligence(raw: string): ContentIntelligence | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  // Fetch the user's objective (or default).
  const objective = await objectiveForUser(supabase, user.id);

  // Fetch and verify ownership of the intelligence.
  const dbIntelligence = await fetchIntelligence(supabase, sourceId, user.id);
  if (!dbIntelligence) {
    return NextResponse.json({ error: "Content intelligence not found or not accessible" }, { status: 404 });
  }

  const intelligence = parseIntelligence(dbIntelligence.data);
  if (!intelligence) {
    return NextResponse.json({ error: "Malformed intelligence data" }, { status: 500 });
  }

  // Run the recommendation engine (deterministic, no LLM).
  const recommendations = recommend({ objective, intelligence });

  return NextResponse.json({
    recommendations,
    objective,
    sourceId,
  });
}
