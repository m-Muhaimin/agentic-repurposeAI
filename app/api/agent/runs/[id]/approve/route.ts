import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { recordAngleDecision } from "@/lib/agent/memory";
import { notifyAgentRunChanged } from "@/lib/notifications";
import { log } from "@/lib/logger";

// POST /api/agent/runs/[id]/approve
// The human gate of Stage 1's Assist mode: the user decides which planned angles
// survive. Accepts a body like:
//   { approval: "approved" | "rejected", ideas: [{ id, approved, title?, description? }] }
// `title`/`description` are optional additive overrides — the user's plan edits
// from the approval surface. Writes the idea flags, records the decision on the
// run, and moves the run to `executing` (or `cancelled` if every angle was
// rejected). A later POST /api/agent/process picks it up.

interface IdeaDecision {
  id: string;
  approved: boolean;
  title?: string;
  description?: string;
}

function isIdeaDecisions(v: unknown): v is IdeaDecision[] {
  return (
    Array.isArray(v) &&
    v.every(
      (i) =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as IdeaDecision).id === "string" &&
        typeof (i as IdeaDecision).approved === "boolean" &&
        ((i as IdeaDecision).title === undefined || typeof (i as IdeaDecision).title === "string") &&
        ((i as IdeaDecision).description === undefined ||
          typeof (i as IdeaDecision).description === "string")
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

  // Persist the user's per-angle call (approved flag + optional plan edits).
  if (isIdeaDecisions(ideas)) {
    for (const idea of ideas) {
      const update: Record<string, string | boolean> = {
        approved: idea.approved,
        updated_at: new Date().toISOString()
      };
      // Plan edits only apply to angles the user decided to keep — a skipped
      // angle's title/description edits are discarded (they won't be generated).
      if (idea.approved) {
        if (typeof idea.title === "string" && idea.title.trim().length > 0) {
          update.title = idea.title.trim();
        }
        if (typeof idea.description === "string" && idea.description.trim().length > 0) {
          update.description = idea.description.trim();
        }
      }
      const { error: ideaErr } = await service
        .from("v4_content_ideas")
        .update(update)
        .eq("id", idea.id)
        .eq("run_id", id)
        .eq("user_id", user.id);
      if (ideaErr) {
        log.warn("agent.approve_idea_failed", { idea_id: idea.id, run_id: id, error: ideaErr.message });
        continue;
      }
      // Durably record the user's keep/reject call as a memory signal, so the
      // P5 strategy agent can see what this creator tends to accept. Best-effort.
      const { data: ideaRow } = await service
        .from("v4_content_ideas")
        .select("title")
        .eq("id", idea.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (ideaRow?.title) {
        await recordAngleDecision(user.id, ideaRow.title, idea.approved ? "approved" : "rejected");
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

  // Notify AFTER the durable status write (persist-first). This is the same
  // transition the orchestrator automates: approved → `executing` (agent.started,
  // deduped per run) and reject-all → `cancelled` (agent.paused, same as the
  // cancel route). Best-effort — the builder never throws.
  await notifyAgentRunChanged(user.id, { id, status: nextStatus });

  log.info("agent.approval_recorded", {
    run_id: id,
    user_id: user.id,
    decision: approval,
    next_status: nextStatus
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}