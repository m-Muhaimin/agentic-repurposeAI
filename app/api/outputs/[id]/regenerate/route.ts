import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOutput, type OutputFormat } from "@/lib/ai/generate";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { getUserPrompts, type UserPromptMap } from "@/lib/prompts";
import { isOutputFormat } from "@/lib/billing/plans";
import { resolvePlan } from "@/lib/billing/entitlements";
import { limitErrorBody } from "@/lib/billing/usage";
import { track, EVENTS } from "@/lib/analytics/events";
import { log } from "@/lib/logger";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // `outputs` has no update RLS policy, so the service client is used for the
  // budget reservation and the eventual content write.
  const service = createServiceClient();

  const { data: output } = await service
    .from("outputs")
    .select("id, source_id, format, regeneration_count")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });
  if (!isOutputFormat(output.format)) {
    return NextResponse.json({ error: "This output can't be regenerated." }, { status: 400 });
  }

  const plan = await resolvePlan(user.id);

  // Regeneration budget is per output row. Reserve the slot BEFORE any paid
  // generation: an optimistic guarded update so two concurrent regenerations
  // can't both pass the cap.
  const current = output.regeneration_count ?? 0;
  if (current >= plan.limits.maxRegenerationsPerJob) {
    log.info("output.regeneration_limit_reached", {
      output_id: output.id,
      user_id: user.id,
      plan: plan.id,
      regenerations: current,
      limit: plan.limits.maxRegenerationsPerJob
    });
    await track(EVENTS.LIMIT_REACHED, user.id, {
      plan: plan.id,
      feature: "regeneration",
      used: current,
      limit: plan.limits.maxRegenerationsPerJob
    });
    return NextResponse.json(
      {
        ...limitErrorBody("REGENERATION_LIMIT_REACHED", {
          used: current,
          limit: plan.limits.maxRegenerationsPerJob
        })
      },
      { status: 429 }
    );
  }

  const reserved = await service
    .from("outputs")
    .update({ regeneration_count: current + 1 })
    .eq("id", output.id)
    .eq("user_id", user.id)
    .eq("regeneration_count", current)
    .select("id")
    .maybeSingle();
  if (!reserved.data) {
    return NextResponse.json(
      { ...limitErrorBody("REGENERATION_LIMIT_REACHED", { limit: plan.limits.maxRegenerationsPerJob }) },
      { status: 429 }
    );
  }

  const { data: source } = await supabase
    .from("sources")
    .select("id, transcript")
    .eq("id", output.source_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!source) {
    // Release the reservation before bailing.
    await service.from("outputs").update({ regeneration_count: current }).eq("id", output.id);
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  if (!source.transcript) {
    await service.from("outputs").update({ regeneration_count: current }).eq("id", output.id);
    return NextResponse.json(
      { error: "No transcript is available yet for this recording." },
      { status: 409 }
    );
  }

  let content: string;
  const startedAt = Date.now();
  try {
    let promptMap: UserPromptMap = {};
    try {
      promptMap = await getUserPrompts(user.id);
    } catch {
      // Keep defaults if the prompt table query fails for any reason.
    }
    content = await generateOutput(
      output.format as OutputFormat,
      source.transcript,
      buildSystemPrompt(output.format as OutputFormat, promptMap)
    );
    log.info("output.regenerated", {
      output_id: output.id,
      source_id: output.source_id,
      format: output.format,
      regeneration: current + 1,
      duration_ms: Date.now() - startedAt
    });
  } catch (err) {
    // Generation failed — give the slot back so users aren't punished for a
    // model outage.
    await service
      .from("outputs")
      .update({ regeneration_count: current })
      .eq("id", output.id)
      .eq("regeneration_count", current + 1);
    const message = err instanceof Error ? err.message : "Generation failed.";
    log.error("output.regenerate_failed", err instanceof Error ? err : new Error(message), {
      output_id: output.id,
      format: output.format,
      duration_ms: Date.now() - startedAt
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await track(EVENTS.REGENERATION_USED, user.id, {
    output_id: output.id,
    source_id: output.source_id,
    format: output.format,
    regeneration: current + 1
  });

  const update = { content, updated_at: new Date().toISOString() };
  const { error } = await service.from("outputs").update(update).eq("id", params.id);
  if (error) {
    // The `updated_at` column may not exist yet if the schema migration wasn't
    // applied — retry without it so regeneration still works.
    if (/could not find the\s*\w*\s*["']?updated_at|column\s+[\w.]*\s*updated_at\s+does\s*(n'?t|not)?\s*exist|undefined_column|42703/i.test(error.message)) {
      const { error: fallbackError } = await service
        .from("outputs")
        .update({ content })
        .eq("id", params.id);
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      return NextResponse.json({ content });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content });
}