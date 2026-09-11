// Stage 4 (BYOB) distribution tool — the REAL publish path.
//
// Triggered strictly as a targeted action: in `automate` mode from the
// orchestrator, or as a manual send from the Publish queue (the manual-approval
// flow). It posts an approved draft to the user's connected Buffer account:
//   1. resolves a usable (refreshing-if-expired) Buffer access token,
//   2. lists the user's Buffer profiles and matches the target platform,
//   3. loads the approved output's content,
//   4. calls Buffer /updates/create.json (Queueing API) — immediately when no
//      scheduledAt, or held by Buffer until the chosen scheduledAt,
//   5. writes the distribution step + flips matching jobs to `published`
//      (immediate) / stays `scheduled` with the Buffer update id (future
//      schedule) — or `failed` with the honest error.
//
// Failure NEVER fabricates success: a rejected/rate-limited Buffer call marks the
// job `failed`, records the error, and surfaces as ok:false. Newsletter has no
// Buffer equivalent and is rejected honestly at profile-match time.

import { createServiceClient } from "@/lib/supabase/server";
import type { AgentTool, ToolContext, ToolResult, DistributionPlatform } from "@/types/agent";
import { getFreshAccessToken } from "@/lib/buffer/connections";
import { fetchProfiles, platformToBufferService, createUpdate, BufferClientError } from "@/lib/buffer/client";
import { notifyPublishChanged } from "@/lib/notifications";
import { log } from "@/lib/logger";

const KNOWN_PLATFORMS: DistributionPlatform[] = [
  "linkedin",
  "x",
  "newsletter",
  "youtube_shorts",
  "tiktok",
  "instagram"
];

export interface DistributionInput {
  platform: DistributionPlatform;
  outputId: string;
  // Optional explicit Buffer profile ids (for the target platform). When
  // omitted the first connected profile matching the platform is used. When
  // provided, every id must be a real connected profile for that platform —
  // otherwise the send fails honestly.
  profileIds?: string[];
  scheduledAt?: string;
}

export const distributionTool: AgentTool = {
  name: "distribution",
  kind: "distribution",
  label: "Schedule / publish",
  requires: ["automate"],
  describe: () =>
    "Publish or schedule an approved draft to the user's connected Buffer account (manual approval required before it sends).",

  async run(ctx: ToolContext, input: unknown): Promise<ToolResult> {
    const { platform, outputId, profileIds, scheduledAt } = (input ?? {}) as DistributionInput;

    if (!KNOWN_PLATFORMS.includes(platform)) {
      return { ok: false, data: null, error: `Unknown platform: ${String(platform)}` };
    }
    if (!outputId) return { ok: false, data: null, error: "outputId required" };

    // The publish gate is handled by the caller (queue send / automate gate).
    // Here we fail closed if no Buffer channel is connected at all.
    const fresh = await getFreshAccessToken(ctx.userId);
    if (!fresh) {
      return {
        ok: false,
        data: null,
        error: "NO_BUFFER_CONNECTION — connect a Buffer account before publishing."
      };
    }

    const service = createServiceClient();

    // Resolve the approved output's content before touching the network so a
    // missing draft fails cleanly (not during Buffer's rate budget).
    const { data: output, error: outputErr } = await service
      .from("outputs")
      .select("id, content")
      .eq("id", outputId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (outputErr || !output || !output.content) {
      const why = outputErr?.message ?? "output not found";
      await markJobFailed(service, ctx, platform, outputId, `Approved draft unavailable: ${why}`);
      return { ok: false, data: null, error: `Approved draft unavailable: ${why}` };
    }

    try {
      const profiles = await fetchProfiles(fresh.token);
      const serviceId = platformToBufferService(platform);
      if (!serviceId) {
        // Honest: no Buffer service backs this platform (newsletter has none).
        await markJobFailed(
          service,
          ctx,
          platform,
          outputId,
          `No connected Buffer profile supports "${platform}".`
        );
        return {
          ok: false,
          data: null,
          error: `No connected Buffer profile supports "${platform}".`
        };
      }

      const platformProfiles = profiles.filter((p) => p.service === serviceId);
      const requested = Array.isArray(profileIds) ? profileIds : [];
      let targets: { id: string }[];
      if (requested.length === 0) {
        targets = platformProfiles.slice(0, 1);
      } else {
        const requestedSet = new Set(requested);
        targets = platformProfiles.filter((p) => requestedSet.has(p.id));
        if (targets.length !== requested.length) {
          // Requested a profile that isn't connected (or isn't on this platform).
          const missing = requested.filter((r) => !requestedSet.has(r) || !platformProfiles.some((p) => p.id === r));
          await markJobFailed(
            service,
            ctx,
            platform,
            outputId,
            `Requested Buffer profile(s) are not connected for "${platform}": ${missing.join(", ")}`
          );
          return {
            ok: false,
            data: null,
            error: `Requested Buffer profile(s) are not connected for "${platform}": ${missing.join(", ")}`
          };
        }
      }
      if (targets.length === 0) {
        await markJobFailed(
          service,
          ctx,
          platform,
          outputId,
          `No connected Buffer profile supports "${platform}".`
        );
        return {
          ok: false,
          data: null,
          error: `No connected Buffer profile supports "${platform}".`
        };
      }

      const result = await createUpdate({
        accessToken: fresh.token,
        text: output.content,
        profileIds: targets.map((t) => t.id),
        scheduledAt
      });

      // ── Success ──
      // Immediate publish → job `published`; future-scheduled send → Buffer holds
      // it for scheduled_at, so the job stays `scheduled` (external_id + chosen
      // time recorded) — never fake `published` for a post not yet live.
      if (scheduledAt) {
        await markJobScheduled(service, ctx, platform, outputId, result.update_id!, scheduledAt);
      } else {
        await markJobPublished(service, ctx, platform, outputId, result.update_id!);
      }
      await recordStep(
        service,
        ctx,
        "done",
        scheduledAt ? `Scheduled on ${platform} via Buffer` : `Published to ${platform} via Buffer`,
        { platform, outputId, scheduledAt: scheduledAt ?? null, profileIds: targets.map((t) => t.id) },
        { updateId: result.update_id, scheduledAt: scheduledAt ?? null }
      );
      log.info(scheduledAt ? "agent.distribution_scheduled" : "agent.distribution_published", {
        user_id: ctx.userId,
        output_id: outputId,
        platform,
        update_id: result.update_id,
        scheduled_at: scheduledAt ?? null
      });
      return {
        ok: true,
        data: {
          updateId: result.update_id,
          platform,
          profileIds: targets.map((t) => t.id),
          scheduled: Boolean(scheduledAt),
          scheduledAt: scheduledAt ?? null
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Buffer publish failed.";
      let errorMessage = message;
      if (err instanceof BufferClientError && err.code === "rate_limited") {
        // Never spin: surface the rate-limit window honestly, let the user retry.
        const retryAfterS = err.retryAfterMs ? Math.round(err.retryAfterMs / 1000) : 60;
        errorMessage = `${message} Retry after ${retryAfterS}s.`;
      }
      await markJobFailed(service, ctx, platform, outputId, errorMessage);
      await recordStep(
        service,
        ctx,
        "failed",
        scheduledAt ? `Scheduling on ${platform} failed` : `Publish to ${platform} failed`,
        { platform, outputId, scheduledAt: scheduledAt ?? null, profileIds },
        { error: errorMessage }
      );
      log.error("agent.distribution_failed", err instanceof Error ? err : new Error(errorMessage), {
        user_id: ctx.userId,
        output_id: outputId,
        platform
      });
      return { ok: false, data: null, error: errorMessage };
    }
  }
};

async function markJobPublished(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  ctx: ToolContext,
  platform: DistributionPlatform,
  outputId: string,
  externalId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("v4_distribution_jobs")
    .update({ status: "published", published_at: now, updated_at: now, external_id: externalId, error_message: null })
    .eq("user_id", ctx.userId)
    .eq("output_id", outputId)
    .eq("platform", platform)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) log.warn("agent.job_published_update_failed", { user_id: ctx.userId, output_id: outputId, platform, message: error.message });
  // Notify AFTER the durable write lands (persist-first), only when a job row
  // actually flipped to published. Best-effort — the builder never throws.
  if (data?.id) {
    await notifyPublishChanged(ctx.userId, { id: data.id }, "published", { channel: platform });
  }
}

// Buffer has ACCEPTED a future-scheduled update: the job is no longer pending
// approval (external_id + chosen scheduled_at recorded, error cleared), but it
// is NOT live yet — status stays `scheduled` until Buffer posts it. We never
// mark it `published` here because the post has not gone live.
async function markJobScheduled(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  ctx: ToolContext,
  platform: DistributionPlatform,
  outputId: string,
  externalId: string,
  scheduledAt: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("v4_distribution_jobs")
    .update({ status: "scheduled", scheduled_at: scheduledAt, updated_at: now, external_id: externalId, error_message: null })
    .eq("user_id", ctx.userId)
    .eq("output_id", outputId)
    .eq("platform", platform)
    .in("status", ["scheduled", "draft"])
    .select("id")
    .maybeSingle();
  if (error) log.warn("agent.job_scheduled_update_failed", { user_id: ctx.userId, output_id: outputId, platform, message: error.message });
  // Notify AFTER the durable write lands (persist-first), only when a job row
  // actually moved to scheduled. Best-effort — the builder never throws.
  if (data?.id) {
    await notifyPublishChanged(ctx.userId, { id: data.id }, "scheduled", { channel: platform });
  }
}

async function markJobFailed(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  ctx: ToolContext,
  platform: DistributionPlatform,
  outputId: string,
  errorMessage: string
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("v4_distribution_jobs")
    .update({ status: "failed", updated_at: now, error_message: errorMessage })
    .eq("user_id", ctx.userId)
    .eq("output_id", outputId)
    .eq("platform", platform)
    .in("status", ["scheduled", "draft"])
    .select("id")
    .maybeSingle();
  if (error) log.warn("agent.job_failed_update_failed", { user_id: ctx.userId, output_id: outputId, platform, message: error.message });
  // Notify AFTER the durable write lands (persist-first), only when a job row
  // actually flipped to failed. Best-effort — the builder never throws.
  if (data?.id) {
    await notifyPublishChanged(ctx.userId, { id: data.id }, "failed", { channel: platform });
  }
}

// Timeline step — ONLY when a real run backs this call. v4_agent_steps.run_id is
// NOT NULL (FK to v4_agent_runs), so a run-less manual send records the durable
// outcome on the job row instead; we never fabricate a step.
async function recordStep(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  ctx: ToolContext,
  status: "done" | "failed",
  label: string,
  input: unknown,
  output: unknown
): Promise<void> {
  if (!ctx.runId) return;
  const runCheck = await service.from("v4_agent_runs").select("id").eq("id", ctx.runId).eq("user_id", ctx.userId).maybeSingle();
  const runExists = !runCheck.error && !!runCheck.data;
  if (!runExists) return;

  const now = new Date().toISOString();
  await service.from("v4_agent_steps").insert({
    run_id: ctx.runId,
    user_id: ctx.userId,
    kind: "distribution",
    status,
    label,
    input: input as never,
    output: output as never,
    retry_count: 0,
    started_at: now,
    finished_at: now
  });
}