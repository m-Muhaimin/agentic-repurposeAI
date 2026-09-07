import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

// POST /api/agent/runs/[id]/cancel
// P2: user-initiated cancellation for any non-terminal run — freshly created,
// parked at approval, or mid-execution. The worker checks between steps
// (`touchRun` in the orchestrator) and stops cleanly, so completed drafts stay
// in the library and on the run. If the run is already terminal, this returns
// its existing status unchanged (idempotent).

const CANCELLABLE = ["created", "planning", "awaiting_approval", "executing", "evaluating"];

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();

  const { data: run, error: fetchError } = await service
    .from("v4_agent_runs")
    .select("id, user_id, status, output_ids")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchError || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // Idempotent: cancelling a cancelled (or otherwise terminal) run is a no-op
  // that reports the truth.
  if (!CANCELLABLE.includes(run.status)) {
    return NextResponse.json({ ok: true, status: run.status, alreadyTerminal: true });
  }

  const now = new Date().toISOString();
  const { error: cancelError } = await service
    .from("v4_agent_runs")
    .update({ status: "cancelled", finished_at: now, updated_at: now, heartbeat_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (cancelError) {
    log.error("agent.cancel_failed", new Error(cancelError.message), { run_id: id, user_id: user.id });
    return NextResponse.json({ error: "Failed to cancel the run." }, { status: 500 });
  }

  log.info("agent.cancelled", {
    run_id: id,
    user_id: user.id,
    status_before: run.status,
    outputs_kept: Array.isArray(run.output_ids) ? run.output_ids.length : 0
  });

  return NextResponse.json({ ok: true, status: "cancelled" });
}