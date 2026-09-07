import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { recordEditSignal } from "@/lib/agent/memory";
import { computeEditDiff } from "@/lib/agent/edit-diff";
import { log } from "@/lib/logger";

const MAX_CONTENT_LENGTH = 100_000;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { content } = await request.json().catch(() => ({}));
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "Content is too long" }, { status: 400 });
  }

  // Fetch the output — include content so we can compute the edit diff for
  // agent-generated drafts (P4 edit-signal capture).
  const { data: output } = await supabase
    .from("outputs")
    .select("id, content")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });

  const originalContent = output.content ?? "";
  const contentChanged = originalContent !== content;

  // `outputs` has no update RLS policy, so the service client is required here.
  const service = createServiceClient();
  const update = { content, updated_at: new Date().toISOString() };
  const { error } = await service.from("outputs").update(update).eq("id", params.id);
  if (error) {
    // The `updated_at` column may not exist yet if the schema migration wasn't
    // applied — retry without it so editing still works.
    if (/could not find the\s*\w*\s*["']?updated_at|column\s+[\w.]*\s*updated_at\s+does\s*(n'?t|not)?\s*exist|undefined_column|42703/i.test(error.message)) {
      const { error: fallbackError } = await service
        .from("outputs")
        .update({ content })
        .eq("id", params.id);
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      // Still capture the edit signal on the fallback path if content changed.
      if (contentChanged) {
        void captureEditSignal(service, user.id, params.id, originalContent, content);
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // P4: record an edit signal when the user edits an agent-generated draft.
  // This is best-effort — a failed signal write never surfaces to the user.
  if (contentChanged) {
    void captureEditSignal(service, user.id, params.id, originalContent, content);
  }

  return NextResponse.json({ ok: true });
}

// Look up whether this output belongs to an agent run, and if so, record a
// typed edit signal so the strategy agent can learn what the user keeps vs
// rewrites. Best-effort, fire-and-forget (never awaited by the save path).
async function captureEditSignal(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  outputId: string,
  originalContent: string,
  editedContent: string
): Promise<void> {
  try {
    // Check if any agent run owns this output. output_ids is a text[] column.
    const { data: run } = await service
      .from("v4_agent_runs")
      .select("id")
      .eq("user_id", userId)
      .contains("output_ids", [outputId])
      .limit(1)
      .maybeSingle();

    if (!run) return; // Not an agent-generated output — skip.

    const diff = computeEditDiff(originalContent, editedContent);
    if (diff.severity === "unchanged") return;

    await recordEditSignal(userId, {
      kind: "edit",
      outputId,
      whatChanged: `${diff.severity}: ${diff.description}`,
      at: new Date().toISOString()
    });

    log.info("agent.edit_signal_captured", {
      user_id: userId,
      output_id: outputId,
      run_id: run.id,
      severity: diff.severity,
      tokens_added: diff.tokensAdded,
      tokens_removed: diff.tokensRemoved
    });
  } catch {
    // Best-effort: a broken signal write must never break the save path.
  }
}