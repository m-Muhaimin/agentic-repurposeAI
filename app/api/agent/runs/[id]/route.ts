import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getRecentSignals } from "@/lib/agent/memory";
import { aggregateMonthlySpend, type MonthlyAgentSpend } from "@/lib/agent/spend";
import { getApiKey } from "@/lib/buffer/connections";
import { publishStatusLabel } from "@/lib/agent/publish";
import { log } from "@/lib/logger";

// GET /api/agent/runs/[id] — full detail for the agent workspace: the run row,
// its content ideas (the plan's approval surface), its durable step timeline,
// the generated draft outputs, the run's distribution jobs (Performance panel
// feed, including MCP-pulled metrics), the MCP API-key availability, and the
// user's recent memory signals (for P7 decision-trail surface).

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  const { data: run, error } = await service
    .from("v4_agent_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const [ideasResult, stepsResult, outputsResult, distributionResult, signals, hasApiKey] = await Promise.all([
    service
      .from("v4_content_ideas")
      .select("*")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    service.from("v4_agent_steps").select("*").eq("run_id", id).eq("user_id", user.id).order("created_at", { ascending: true }),
    run.output_ids.length > 0
      ? service.from("outputs").select("*").in("id", run.output_ids).eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    service.from("v4_distribution_jobs").select("*").eq("run_id", id).eq("user_id", user.id).order("updated_at", { ascending: false }),
    getRecentSignals(user.id),
    getApiKey(user.id)
  ]);

  const ideas = ideasResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const outputs = outputsResult.data ?? [];
  const distributionJobs = ((distributionResult.data ?? []) as Array<{ status: string | null }>).map((j) => ({
    ...j,
    statusLabel: publishStatusLabel(j.status as Parameters<typeof publishStatusLabel>[0])
  }));

  // Monthly agent spend for the consumer budget line (service-role query, same
  // aggregation semantics as the strategy surface — honest totals, never new data).
  let monthlySpend: MonthlyAgentSpend | null = null;
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: monthRuns } = await service
      .from("v4_agent_runs")
      .select("input_tokens, output_tokens, cost_units, status")
      .eq("user_id", user.id)
      .gte("created_at", monthStart);
    monthlySpend = aggregateMonthlySpend(monthRuns ?? []);
  } catch {
    monthlySpend = null;
  }

  log.info("agent.run_detail", { run_id: id, user_id: user.id });

  return NextResponse.json({ run, ideas, steps, outputs, distributionJobs, signals, monthlySpend, hasApiKey });
}