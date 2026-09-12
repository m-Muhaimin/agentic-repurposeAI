import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processAgentRun } from "@/lib/agent/orchestrator";
import { processAgentRunV1 } from "@/lib/agent/orchestrator-bridge";
import { isOrchestratorV1Enabled } from "@/lib/agent/orchestrator/flag";
import { log } from "@/lib/logger";

// POST /api/agent/process — SSE worker, mirrors /api/process: claim a run and
// stream progress. Planning parks at `awaiting_approval`; execution runs all the
// way to `done`. Both flow through the same endpoint — a re-POST picks the run
// up from wherever it parked.

const encoder = new TextEncoder();

function sseResponse(run: (send: (event: string, data: unknown) => void) => Promise<void>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client went away — stop pumping; the run keeps progressing via its
          // durable sequence of v4_agent_steps.
        }
      };
      try {
        await run(send);
      } catch {
        // run() reports its own failures as `error` events.
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    }
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform"
    }
  });
}

export async function POST(request: Request) {
  const { runId } = await request.json();
  if (!runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Confirm the caller owns this run before we do any work on it. The exact
  // ownership check rides through to the claim inside the orchestrator (which
  // uses the service client for RLS-free writes).
  const { data: owned, error } = await supabase
    .from("v4_agent_runs")
    .select("id")
    .eq("id", runId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !owned) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  log.info("agent.process_requested", { run_id: runId, user_id: user.id });

  const v1Enabled = isOrchestratorV1Enabled();

  return sseResponse(async (send) => {
    if (v1Enabled) {
      await processAgentRunV1(runId, send);
    } else {
      await processAgentRun(runId, send);
    }
  });
}