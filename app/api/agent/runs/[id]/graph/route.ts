import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildAgentGraph, type AgentGraphInput } from "@/lib/agent/graph";
import { log } from "@/lib/logger";

// GET /api/agent/runs/[id]/graph — the authoritative workflow graph for one
// agent run, derived entirely from durable backend state. The frontend React
// Flow canvas maps this 1:1 to node components. The graph is never persisted;
// it is rebuilt on every read.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  // ── Run ─────────────────────────────────────────────────────────────────────
  const { data: run, error: runErr } = await service
    .from("v4_agent_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (runErr || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // ── Source ──────────────────────────────────────────────────────────────────
  const { data: source } = await service
    .from("sources")
    .select("id, title, source_type, status, duration_seconds")
    .eq("id", run.source_id)
    .eq("user_id", user.id)
    .maybeSingle();

  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [ideasResult, stepsResult, outputsResult, distResult, intelResult] = await Promise.all([
    service
      .from("v4_content_ideas")
      .select("id, title, suggested_formats, quotes, approved")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    service
      .from("v4_agent_steps")
      .select("kind, status, label")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    run.output_ids.length > 0
      ? service.from("outputs").select("id, format, content").in("id", run.output_ids).eq("user_id", user.id)
      : Promise.resolve({ data: [] as { id: string; format: string; content: string }[] }),
    run.output_ids.length > 0
      ? service
          .from("v4_distribution_jobs")
          .select("id, platform, status, error_message")
          .or(`run_id.eq.${id},output_id.in.(${run.output_ids.join(",")})`)
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] as { id: string; platform: string; status: string; error_message: string | null }[] }),
    service
      .from("content_intelligence")
      .select("intelligence")
      .eq("source_id", run.source_id)
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  // ── Intelligence summary (counts only — never return transcript / evidence text) ──
  let intelligence: AgentGraphInput["intelligence"] = null;
  const intel = intelResult.data?.intelligence as Record<string, unknown> | null | undefined;
  if (intel && typeof intel === "object") {
    const top = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    const quotes = top((intel as Record<string, unknown>).quotes);
    const topics = top((intel as Record<string, unknown>).topics);
    const claims = top((intel as Record<string, unknown>).claims);
    const insights = top((intel as Record<string, unknown>).insights);
    const opps = top((intel as Record<string, unknown>).opportunities);
    intelligence = { topics, claims, quotes, insights, opportunities: opps };
  }

  const graph = buildAgentGraph({
    source,
    run,
    ideas: ideasResult.data ?? [],
    steps: stepsResult.data ?? [],
    outputs: outputsResult.data ?? [],
    distributionJobs: distResult.data ?? [],
    intelligence
  });

  log.info("agent.run_graph", { run_id: id, user_id: user.id, nodeCount: graph.nodes.length });

  return NextResponse.json({ graph });
}