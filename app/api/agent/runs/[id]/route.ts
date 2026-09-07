import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

// GET /api/agent/runs/[id] — full detail for the agent workspace: the run row,
// its content ideas (the plan's approval surface), its durable step timeline,
// and the generated draft outputs.

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

  const [ideasResult, stepsResult, outputsResult] = await Promise.all([
    service
      .from("v4_content_ideas")
      .select("*")
      .eq("run_id", id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    service.from("v4_agent_steps").select("*").eq("run_id", id).eq("user_id", user.id).order("created_at", { ascending: true }),
    run.output_ids.length > 0
      ? service.from("outputs").select("*").in("id", run.output_ids).eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null })
  ]);

  const ideas = ideasResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const outputs = outputsResult.data ?? [];

  log.info("agent.run_detail", { run_id: id, user_id: user.id });

  return NextResponse.json({ run, ideas, steps, outputs });
}