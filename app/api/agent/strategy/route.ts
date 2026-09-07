import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { strategyTool } from "@/lib/agent/tools/strategy";
import { log } from "@/lib/logger";

// GET /api/agent/strategy  — the strategy docs the agent has written for this
//                          user (Stage 4 seed: read-only, mostly the heuristic
//                          weekly docs).
// POST /api/agent/strategy — regenerate a heuristic strategy seed right now.
//                          Explicit user trigger; the agent never auto-writes.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const { data: strategies, error } = await service
    .from("v4_content_strategies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (/could not find the\s*\w*\s*["']?[\w.]*v4_content_strategies|does\s*not\s*exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({ strategies: [] });
    }
    log.error("agent.strategy_list_failed", new Error(error.message), { user_id: user.id });
    return NextResponse.json({ error: "Failed to load strategy docs." }, { status: 500 });
  }

  return NextResponse.json({ strategies: strategies ?? [] });
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const result = await strategyTool.run(
    { userId: user.id, runId: "strategy", mode: "automate" },
    { lookbackDays: 7 }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Strategy generation failed." }, { status: 400 });
  }

  const { strategyId, body } = result.data as { strategyId: string; body: string };
  log.info("agent.strategy_user_triggered", { user_id: user.id, strategy_id: strategyId });

  return NextResponse.json({ ok: true, strategyId, body });
}