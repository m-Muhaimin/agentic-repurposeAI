import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AGENT_MODES, type AgentMode } from "@/types/agent";
import { DEFAULT_MODE } from "@/lib/agent/permissions";
import { ensureAgentPreferences } from "@/lib/agent/memory";
import { resolvePlan } from "@/lib/billing/entitlements";
import { log } from "@/lib/logger";

// POST /api/agent/runs — start a new agentic run for a source.
// GET /api/agent/runs — list the user's runs (with source titles for display).

function isAgentMode(v: unknown): v is AgentMode {
  return typeof v === "string" && (AGENT_MODES as string[]).includes(v);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { sourceId, mode: rawMode } = body;
  if (!sourceId) return NextResponse.json({ error: "sourceId is required" }, { status: 400 });

  const mode = isAgentMode(rawMode) ? rawMode : DEFAULT_MODE;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: source, error: fetchError } = await supabase
    .from("sources")
    .select("id, user_id, status")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  // The agent works from a transcript, so the source must already have one
  // (a done repurpose job produced it).
  if (source.status !== "done" && source.status !== "failed") {
    return NextResponse.json(
      { error: "Source is still processing — the agent needs the transcript first." },
      { status: 409 }
    );
  }

  const service = createServiceClient();

  // Seed the user's memory row on their first agent run (safe upsert; the
  // mutable fields stay user-gated).
  await ensureAgentPreferences(user.id);

  // Budget snapshot: read server-side from the user's plan and persist it on
  // the run, so an in-flight run is never re-budgeted by a later plan change.
  // The client's mode request changes what the agent MAY do, never how much.
  const plan = await resolvePlan(user.id);
  const agentBudget = plan.limits.agent;

  const { data: run, error } = await service
    .from("v4_agent_runs")
    .insert({
      user_id: user.id,
      source_id: sourceId,
      mode,
      max_steps: agentBudget.maxSteps,
      max_cost_units: agentBudget.maxCostUnits,
      max_runtime_s: agentBudget.maxRuntimeSeconds
    })
    .select("id, status, mode, created_at, max_steps, max_cost_units, max_runtime_s")
    .single();

  if (error) {
    const message = error.message;
    if (/could not find the\s*\w*\s*["']?[\w.]*v4_agent_runs|does\s*not\s*exist|PGRST205|42P01/i.test(message)) {
      return NextResponse.json(
        { error: "Agent schema not applied yet — run supabase/schema_agentic.sql first." },
        { status: 503 }
      );
    }
    log.error("agent.run_insert_failed", new Error(message), { user_id: user.id, source_id: sourceId, mode });
    return NextResponse.json({ error: "Failed to start the agent run." }, { status: 500 });
  }

  log.info("agent.run_created", { run_id: run.id, source_id: sourceId, user_id: user.id, mode });
  return NextResponse.json({ ok: true, run }, { status: 201 });
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const { data: runs, error } = await service
    .from("v4_agent_runs")
    .select("id, source_id, mode, status, plan, step_count, output_ids, error_message, created_at, updated_at, finished_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (/could not find the\s*\w*\s*["']?[\w.]*v4_agent_runs|does\s*not\s*exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({ runs: [] });
    }
    log.error("agent.run_list_failed", new Error(error.message), { user_id: user.id });
    return NextResponse.json({ error: "Failed to list agent runs." }, { status: 500 });
  }

  // Join source titles for the list UI (no SQL join in the typed client — do a
  // second query keyed by the source ids we got back).
  const runsList = (runs ?? []) as Array<{ id: string; source_id: string }>;
  const sourceIds = [...new Set(runsList.map((r) => r.source_id))];
  let titleById: Record<string, string> = {};
  if (sourceIds.length > 0) {
    const { data: sources } = await service
      .from("sources")
      .select("id, title")
      .in("id", sourceIds)
      .eq("user_id", user.id);
    titleById = Object.fromEntries((sources ?? []).map((s: { id: string; title: string }) => [s.id, s.title]));
  }

  return NextResponse.json({
    runs: runsList.map((r) => ({
      ...r,
      sourceTitle: titleById[r.source_id] ?? "Untitled source"
    }))
  });
}