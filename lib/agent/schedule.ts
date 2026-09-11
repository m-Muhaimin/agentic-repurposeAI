// P-EXT: automate-mode distribution — real scheduling to Buffer via the MCP
// connector, plus post-metrics for agent evaluation.
//
// This is the agent-driven complement to the manual publish queue (Stage 4 /
// lib/agent/tools/distribution.ts). Where the manual path sends on a human
// click via OAuth GraphQL, this module schedules the run's approved drafts
// into the Buffer queue (create_post, mode addToQueue) using the per-user
// Buffer API key over the MCP connector — the "automate" capability. Metrics
// pulls (list_posts with includeMetrics) land on the distribution jobs so the
// run detail can show a performance panel.
//
// Honesty rules:
//   - No Buffer API key            → scheduling step `skipped`; run still `done`.
//   - No serviceable channel for a format (newsletter has none) → per-output
//     `skipped` step with the reason; never a fabricated job.
//   - A create that fails          → per-output `failed` step + `failed` job;
//     the run itself stays `done` (partial completion — drafts are the runtime
//     contract, scheduling is a best-effort bonus).
//   - Only shared text post goes to the queue: `dueAt` is set by Buffer (automatic),
//     so we never invent a publish time of our own.

import type { OutputFormat, DistributionPlatform } from "@/types/agent";
import { createServiceClient } from "@/lib/supabase/server";
import { getApiKey } from "@/lib/buffer/connections";
import {
  mcpGetAccount,
  mcpListChannels,
  mcpCreatePost,
  mcpListPosts,
  BufferMcpError,
  type BufferChannelMCP
} from "@/lib/buffer/mcp";
import { platformToBufferService } from "@/lib/buffer/client";
import { notifyPublishChanged } from "@/lib/notifications";
import { log } from "@/lib/logger";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// Which delivered format goes to which Buffer platform. `newsletter` is text
// delivered by email (VervAI's own newsletter section); Buffer has no channel
// for it, so it's honestly skipped with no fabricated job. Threads schedule to
// X (native thread destination); carousel scripts schedule to LinkedIn
// (document-post destination) — both land in the queue as their source text,
// ready for the creator to finalize into the native multi-asset post.
export const OUTPUT_FORMAT_TO_PLATFORM: Partial<Record<OutputFormat, DistributionPlatform>> = {
  linkedin_post: "linkedin",
  shortform_script: "x",
  thread: "x",
  carousel: "linkedin"
};

export interface ScheduleTarget {
  outputId: string;
  format: OutputFormat;
  platform: DistributionPlatform;
  channelId: string;
  channelName: string | null;
  text: string;
}

export interface ScheduleSkip {
  outputId: string;
  format: OutputFormat;
  reason: string;
}

// Pure: pick a Buffering channel per draft. Deterministic + explicit — a draft
// with no serviceable channel is listed as skipped, never silently dropped.
export function planScheduleTargets(
  outputs: Array<{ id: string; format: string; content: string | null }>,
  channels: BufferChannelMCP[]
): { targets: ScheduleTarget[]; skipped: ScheduleSkip[] } {
  const targets: ScheduleTarget[] = [];
  const skipped: ScheduleSkip[] = [];

  for (const output of outputs) {
    const format = output.format as OutputFormat;
    const platform = OUTPUT_FORMAT_TO_PLATFORM[format];
    const channel = channels.find((c) => {
      const service = platform ? platformToBufferService(platform) : null;
      return service ? c.service.toLowerCase() === service.toLowerCase() : false;
    });

    if (!platform) {
      skipped.push({ outputId: output.id, format, reason: `${format} has no Buffer channel (it's an email/newsletter format).` });
      continue;
    }
    if (!channel) {
      skipped.push({ outputId: output.id, format, reason: `No connected ${platform} channel in the Buffer account.` });
      continue;
    }
    if (!output.content?.trim()) {
      skipped.push({ outputId: output.id, format, reason: `${format} draft is empty.` });
      continue;
    }
    targets.push({
      outputId: output.id,
      format,
      platform,
      channelId: channel.id,
      channelName: channel.name,
      text: output.content
    });
  }
  return { targets, skipped };
}

export interface RunContext {
  userId: string;
  runId: string;
  mode: "assist" | "execute" | "automate";
}

export interface ScheduleRunResult {
  scheduled: number;
  skipped: number;
  failed: number;
  notConfigured: boolean;
}

// Insert a distribution audit step for the run (kind `distribution`).
async function recordDistributionStep(
  service: ServiceClient,
  ctx: RunContext,
  status: "running" | "done" | "failed" | "skipped",
  label: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>
): Promise<void> {
  const { error } = await service.from("v4_agent_steps").insert({
    run_id: ctx.runId,
    user_id: ctx.userId,
    kind: "distribution",
    status,
    label,
    input,
    output,
    started_at: new Date().toISOString(),
    finished_at: status === "running" ? null : new Date().toISOString()
  });
  if (error && !/could not find|does\s*n?o?t?\s*exist|PGRST205|42P01/i.test(error.message)) {
    log.warn("agent.distribution_step_write_failed", { run_id: ctx.runId, status, message: error.message });
  }
}

async function loadChannels(apiKey: string): Promise<BufferChannelMCP[]> {
  const account = await mcpGetAccount(apiKey);
  const channels: BufferChannelMCP[] = [];
  for (const org of account.organizations) {
    const orgChannels = await mcpListChannels(apiKey, org.id);
    channels.push(...orgChannels);
  }
  return channels;
}

function errorMessage(err: unknown): string {
  if (err instanceof BufferMcpError) {
    return err.retryAfterMs ? `Buffer scheduling failed — retry after ${Math.round(err.retryAfterMs / 1000)}s.` : err.message;
  }
  return err instanceof Error ? err.message : "Scheduling to Buffer failed.";
}

// Schedule a run's approved drafts into the user's Buffer queue. Best-effort:
// returns counts and never throws — the run lifecycle owns failures.
export async function scheduleRunOutputs(
  service: ServiceClient,
  ctx: RunContext,
  outputIds: string[]
): Promise<ScheduleRunResult> {
  if (ctx.mode !== "automate") {
    return { scheduled: 0, skipped: 0, failed: 0, notConfigured: true };
  }

  const apiKey = await getApiKey(ctx.userId);
  if (!apiKey) {
    await recordDistributionStep(service, ctx, "skipped", "Scheduling skipped — no Buffer API key", { outputIds }, { reason: "no_buffer_api_key" });
    log.info("agent.schedule_no_api_key", { run_id: ctx.runId, user_id: ctx.userId });
    return { scheduled: 0, skipped: 0, failed: 0, notConfigured: true };
  }

  if (!outputIds.length) {
    await recordDistributionStep(service, ctx, "skipped", "Scheduling skipped — no approved drafts", { outputIds }, { reason: "no_outputs" });
    return { scheduled: 0, skipped: 0, failed: 0, notConfigured: false };
  }

  const { data: outputs, error: outputsError } = await service
    .from("outputs")
    .select("id, format, content")
    .in("id", outputIds)
    .eq("user_id", ctx.userId);
  if (outputsError || !outputs?.length) {
    await recordDistributionStep(service, ctx, "skipped", "Scheduling skipped — drafts could not be read", { outputIds }, { reason: outputsError?.message ?? "no_outputs" });
    return { scheduled: 0, skipped: 0, failed: 0, notConfigured: false };
  }

  const channels = await loadChannels(apiKey);
  const { targets, skipped } = planScheduleTargets(outputs as Array<{ id: string; format: string; content: string | null }>, channels);

  let scheduled = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const post = await mcpCreatePost(apiKey, {
        channelId: target.channelId,
        text: target.text,
        mode: "addToQueue"
      });
      if (!post.id) throw new BufferMcpError("Buffer accepted the post but returned no ID.", "buffer_error");

      const { data: jobRow, error: jobError } = await service.from("v4_distribution_jobs").insert({
        run_id: ctx.runId,
        user_id: ctx.userId,
        output_id: target.outputId,
        platform: target.platform,
        status: "scheduled",
        scheduled_at: post.dueAt ?? null,
        published_at: null,
        external_id: post.id,
        error_message: null
      }).select("id").maybeSingle();
      if (jobError) throw new Error(`Could not record distribution job: ${jobError.message}`);

      // Notify AFTER the durable scheduled insert lands (persist-first).
      // Best-effort — the builder never throws.
      if (jobRow?.id) {
        await notifyPublishChanged(ctx.userId, { id: jobRow.id }, "scheduled", { channel: target.platform });
      }

      await recordDistributionStep(
        service,
        ctx,
        "done",
        `Scheduled ${target.format} - ${target.platform} into the Buffer queue (automate)`,
        { outputId: target.outputId, platform: target.platform, channelId: target.channelId },
        { externalId: post.id, dueAt: post.dueAt ?? null }
      );
      scheduled += 1;
    } catch (err) {
      failed += 1;
      const message = errorMessage(err);
      const { data: failedJob } = await service.from("v4_distribution_jobs").insert({
        run_id: ctx.runId,
        user_id: ctx.userId,
        output_id: target.outputId,
        platform: target.platform,
        status: "failed",
        error_message: message
      }).select("id").maybeSingle();
      // Notify AFTER the durable failed insert lands (persist-first).
      // Best-effort — the builder never throws.
      if (failedJob?.id) {
        await notifyPublishChanged(ctx.userId, { id: failedJob.id }, "failed", { channel: target.platform });
      }
      await recordDistributionStep(
        service,
        ctx,
        "failed",
        `Scheduling ${target.format} - ${target.platform} failed`,
        { outputId: target.outputId, platform: target.platform, channelId: target.channelId },
        { error: message }
      );
    }
  }

  for (const skip of skipped) {
    await recordDistributionStep(
      service,
      ctx,
      "skipped",
      `Skipped ${skip.format} - ${skip.reason}`,
      { outputId: skip.outputId, format: skip.format },
      { reason: skip.reason }
    );
  }

  log.info("agent.schedule_done", {
    run_id: ctx.runId,
    user_id: ctx.userId,
    scheduled,
    skipped: skipped.length,
    failed
  });

  return { scheduled, skipped: skipped.length, failed, notConfigured: false };
}

export interface MetricsRefreshResult {
  scanned: number;
  updated: number;
  errors: string[];
}

// Pull fresh per-post metrics (list_posts with includeMetrics) for every
// distribution job that has an external_id, and store them on the job. This is
// the "review metrics" step the evaluate phase can drive — the deterministic
// rubric stays unchanged; metrics are evidence, not a new judge.
export async function refreshRunMetrics(
  service: ServiceClient,
  userId: string
): Promise<MetricsRefreshResult> {
  const apiKey = await getApiKey(userId);
  if (!apiKey) return { scanned: 0, updated: 0, errors: ["no_buffer_api_key"] };

  const { data: jobs } = await service
    .from("v4_distribution_jobs")
    .select("id, external_id")
    .eq("user_id", userId)
    .not("external_id", "is", null);
  if (!jobs?.length) return { scanned: 0, updated: 0, errors: [] };

  const account = await mcpGetAccount(apiKey);
  const jobRows = jobs as Array<{ id: string; external_id: string | null }>;
  const wanted = new Set(jobRows.map((j) => j.external_id as string));
  const metricsById = new Map<string, Record<string, unknown>>();

  for (const org of account.organizations) {
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const posts = await mcpListPosts(apiKey, {
        organizationId: org.id,
        first: 100,
        after: cursor,
        includeMetrics: true
      });
      for (const post of posts) {
        if (post.id && post.metrics && wanted.has(post.id)) {
          metricsById.set(post.id, post.metrics);
        }
      }
      const last = posts[posts.length - 1];
      if (!last?.id || posts.length < 100) break;
      cursor = last.id;
    }
  }

  let updated = 0;
  const now = new Date().toISOString();
  for (const job of jobRows) {
    const metrics = job.external_id ? metricsById.get(job.external_id) : undefined;
    if (!metrics) continue;
    const { error } = await service
      .from("v4_distribution_jobs")
      .update({ metrics: metrics as never, metrics_refreshed_at: now, updated_at: now })
      .eq("id", job.id);
    if (error) return { scanned: jobs.length, updated, errors: [error.message] };
    updated += 1;
  }

  log.info("agent.metrics_refresh_done", { user_id: userId, scanned: jobs.length, updated });
  return { scanned: jobs.length, updated, errors: [] };
}