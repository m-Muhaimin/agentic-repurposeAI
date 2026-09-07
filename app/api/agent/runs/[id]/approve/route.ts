import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

// POST /api/agent/runs/[id]/approve
// The human gate of Stage 1's Assist mode: the user decides which planned angles
// survive. Accepts a body like:
//   { approval: "approved" | "rejected", ideas: [{ id, approved }] }
// Writes the idea flags, records the decision on the run, and moves the run to
// `executing` (or `cancelled` if every angle was rejected). A later
// POST /api/agent/process picks it up.

type IdeaDecision = { id: string; approved: boolean };

function isIdeaDecisions(v: unknown): v is IdeaDecision[] {
  return (
    Array.isArray(v) &&
    v.every(
      (i) =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as IdeaDecision).id === "string" &&
        typeof (i as IdeaDecision).approved === "boolean"
    )
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Can only approve a run that's parked awaiting approval, owned by the caller.
  const { data: run, error } = await supabase
    .from("v4_agent_runs")
    .select("id, source_id, user_id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "awaiting_approval") {
    return NextResponse.json({ error: "Run is not awaiting approval" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { approval, ideas } = body as { approval?: string; ideas?: unknown };

  if (approval !== "approved" && approval !== "rejected") {
    return NextResponse.json({ error: "approval must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const service = createServiceClient();

  if (Array.isArray(ideas) && ideas.length === 0) {
    return NextResponse.json({ error: "ideas must be a non-empty array" }, { status: 400 });
  }

  // Persist the user's per-angle call.
  if (isIdeaDecisions(ideas)) {
    for (const idea of ideas) {
      const { error: ideaErr } = await service
        .from("v4_content_ideas")
        .update({ approved: idea.approved, updated_at: new Date().toISOString() })
        .eq("id", idea.id)
        .eq("run_id", id)
        .eq("user_id", user.id);
      if (ideaErr) {
        log.warn("agent.approve_idea_failed", { idea_id: idea.id, run_id: id, error: ideaErr.message });
      }
    }
  }

  const anyApproved = isIdeaDecisions(ideas) ? ideas.some((i) => i.approved) : approval === "approved";

  const nextStatus = anyApproved ? "executing" : "cancelled";

  const { error: updateErr } = await service
    .from("v4_agent_runs")
    .update({
      status: nextStatus,
      approval_decision: approval,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateErr) {
    log.error("agent.approve_update_failed", new Error(updateErr.message), { run_id: id });
    return NextResponse.json({ error: "Failed to record approval." }, { status: 500 });
  }

  log.info("agent.approval_recorded", {
    run_id: id,
    user_id: user.id,
    decision: approval,
    next_status: nextStatus
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}