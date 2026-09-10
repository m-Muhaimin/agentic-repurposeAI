import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AGENT_MODES, type AgentMode } from "@/types/agent";
import { DEFAULT_MODE } from "@/lib/agent/permissions";
import { ensureAgentPreferences } from "@/lib/agent/memory";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getApiKey } from "@/lib/buffer/connections";
import { mcpGetPost, BufferMcpError } from "@/lib/buffer/mcp";
import { saveTranscript } from "@/lib/ingestion/save";
import { log } from "@/lib/logger";

// POST /api/agent/repurpose — take an existing Buffer post and run the whole
// pipeline on it: the post's text becomes a transcript-style source (status
// `done`, transcript written to both sources.transcript and the canonical
// transcripts table) and an agent run starts on it immediately. This is the
// "repurpose an existing post" flow — same agent pipeline, new source.

function isAgentMode(v: unknown): v is AgentMode {
  return typeof v === "string" && (AGENT_MODES as string[]).includes(v);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });
  const mode = isAgentMode(body.mode) ? body.mode : DEFAULT_MODE;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add a Buffer API key to repurpose your Buffer posts.", code: "NO_BUFFER_API_KEY" },
      { status: 503 }
    );
  }

  const service = createServiceClient();

  let text: string;
  try {
    const post = await mcpGetPost(apiKey, postId);
    text = (post.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "That Buffer post has no text to repurpose." }, { status: 422 });
    }
  } catch (err) {
    const code = err instanceof BufferMcpError ? err.code : "buffer_error";
    const message = err instanceof BufferMcpError ? err.message : "Could not reach the Buffer MCP connector.";
    log.error("agent.repurpose_fetch_failed", err instanceof Error ? err : new Error(message), {
      user_id: user.id,
      post_id: postId,
      code
    });
    return NextResponse.json({ ok: false, error: message, code }, { status: 502 });
  }

  // Persist as a transcript-style source. source_has_location demands
  // storage_path or source_url for transcript rows; this source has no bytes,
  // so we use a marker path (same convention as the agentic e2e fixtures).
  const sourcePath = `${user.id}/buffer-post/${postId}`;
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      title: `Buffer post ${postId.slice(0, 8)}`,
      source_type: "transcript",
      status: "done",
      storage_path: sourcePath,
      transcript: text
    })
    .select("id")
    .single();
  if (sourceError || !source) {
    log.error("agent.repurpose_source_insert_failed", new Error(sourceError?.message ?? "no source row"), {
      user_id: user.id,
      post_id: postId
    });
    return NextResponse.json({ error: "Could not save the source." }, { status: 500 });
  }

  // Canonical transcript row (worker pattern; degrades gracefully if `transcripts`
  // is missing — the transcript already landed in sources.transcript).
  await saveTranscript(service, { id: source.id, user_id: user.id }, {
    text,
    provider: "transcript_file",
    source: { type: "transcript" }
  });

  // Seed the memory row + budget snapshot, exactly like POST /api/agent/runs.
  await ensureAgentPreferences(user.id);
  const plan = await resolvePlan(user.id);
  const agentBudget = plan.limits.agent;

  const { data: run, error: runError } = await service
    .from("v4_agent_runs")
    .insert({
      user_id: user.id,
      source_id: source.id,
      mode,
      max_steps: agentBudget.maxSteps,
      max_cost_units: agentBudget.maxCostUnits,
      max_runtime_s: agentBudget.maxRuntimeSeconds
    })
    .select("id, status, mode, created_at, max_steps, max_cost_units, max_runtime_s")
    .single();
  if (runError) {
    const message = runError.message;
    if (/could not find the\s*\w*\s*["']?[\w.]*v4_agent_runs|does\s*not\s*exist|PGRST205|42P01/i.test(message)) {
      return NextResponse.json(
        { error: "Agent schema not applied yet — run supabase/schema_agentic.sql first." },
        { status: 503 }
      );
    }
    log.error("agent.repurpose_run_insert_failed", new Error(message), {
      user_id: user.id,
      source_id: source.id,
      post_id: postId,
      mode
    });
    return NextResponse.json({ error: "Failed to start the agent run." }, { status: 500 });
  }

  log.info("agent.repurpose_run_created", {
    run_id: run.id,
    source_id: source.id,
    user_id: user.id,
    post_id: postId,
    mode
  });

  return NextResponse.json(
    { ok: true, sourceId: source.id, run },
    { status: 201 }
  );
}