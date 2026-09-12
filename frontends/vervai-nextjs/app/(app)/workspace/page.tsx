import WorkspaceHeader from "@/components/workspace/WorkspaceHeader";
import PipelineGraph, { type PipelineStage } from "@/components/workspace/PipelineGraph";
import PlanBlueprint, { type BlueprintStep } from "@/components/workspace/PlanBlueprint";
import IngestionTelemetry from "@/components/workspace/IngestionTelemetry";
import AngleReservoir from "@/components/workspace/AngleReservoir";
import {
  getSourcesWithOutputs,
  getAgentRuns,
  getRecentIdeas,
  getDistributionJobs,
  timeAgo,
  formatDuration,
  SOURCE_TYPE_META,
  SOURCE_STATUS_LABEL,
  FORMAT_LABEL,
  type SourceRow,
  type SourceStatus,
} from "@/lib/data";

type PlainObject = Record<string, unknown>;

const DEFAULT_STAGE_ICONS = [
  "upload_file",
  "mic",
  "insights",
  "electric_bolt",
  "how_to_reg",
  "layers",
  "check_circle",
];

const STAGE_TIER: { tier: number; label: string; icon: string }[] = [
  { tier: 0, label: "Source Ingested", icon: "upload_file" },
  { tier: 1, label: "Transcription", icon: "mic" },
  { tier: 2, label: "Insight Extraction", icon: "insights" },
  { tier: 3, label: "Output Generation", icon: "layers" },
  { tier: 4, label: "Human Sign-off", icon: "how_to_reg" },
];

const STATUS_TIER: Record<SourceStatus, number> = {
  uploaded: 0,
  transcribing: 1,
  transcribed: 2,
  generating: 3,
  done: 4,
  failed: -1,
};

function planItems(plan: Record<string, unknown> | null): unknown[] {
  if (!plan) return [];
  if (Array.isArray(plan)) return plan;
  const list =
    plan.steps ?? plan.stages ?? plan.items ?? plan.outputs ?? plan.targets ?? plan.plan;
  if (Array.isArray(list)) return list;
  const hasScalar = Object.values(plan).some(
    (v) => typeof v === "string" || typeof v === "number",
  );
  return hasScalar ? [plan] : [];
}

function asObject(value: unknown): PlainObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PlainObject)
    : {};
}

function strField(obj: PlainObject, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function stageState(status: unknown): PipelineStage["state"] {
  const s = typeof status === "string" ? status.toLowerCase() : "";
  if (["done", "complete", "completed", "finished", "success", "approved"].includes(s)) {
    return "complete";
  }
  if (
    ["running", "in_progress", "in-progress", "active", "current", "selected", "generating", "processing", "drafting"].includes(
      s,
    )
  ) {
    return "selected";
  }
  if (["queued", "waiting", "scheduled", "pending_queue"].includes(s)) {
    return "queued";
  }
  return "pending";
}

function buildStages(plan: Record<string, unknown> | null): PipelineStage[] {
  return planItems(plan).map((item, i) => {
    if (typeof item === "string") {
      return {
        state: "pending",
        icon: DEFAULT_STAGE_ICONS[i % DEFAULT_STAGE_ICONS.length],
        label: item,
        meta: "",
      };
    }
    const obj = asObject(item);
    const label = strField(obj, ["title", "label", "name"]) ?? `Stage ${i + 1}`;
    const icon = strField(obj, ["icon"]) ?? DEFAULT_STAGE_ICONS[i % DEFAULT_STAGE_ICONS.length];
    const meta = strField(obj, ["description", "summary", "meta", "detail"]) ?? "";
    return { state: stageState(obj.status), icon, label, meta };
  });
}

function sourceLifecycleStages(sources: SourceRow[]): PipelineStage[] {
  const latest = sources[0];
  if (!latest) return [];
  const tier = STATUS_TIER[latest.status];
  const failed = latest.status === "failed";
  return STAGE_TIER.map((stage) => {
    let state: PipelineStage["state"] = "pending";
    if (failed) {
      state = stage.tier < 1 ? "complete" : stage.tier === 1 ? "selected" : "pending";
    } else if (stage.tier < tier) {
      state = "complete";
    } else if (stage.tier === tier) {
      state = tier >= 4 ? "complete" : "selected";
    }
    let meta = "";
    if (stage.tier === 0) {
      meta = `${SOURCE_TYPE_META[latest.source_type].label}${
        latest.duration_seconds ? ` • ${formatDuration(latest.duration_seconds)}` : ""
      }`;
    } else if (failed && stage.tier === 1) {
      meta = "Failed — review source";
    } else if (stage.tier === tier && !failed) {
      meta = `${SOURCE_STATUS_LABEL[latest.status]} • ${timeAgo(latest.created_at)}`;
    }
    return { state, icon: stage.icon, label: stage.label, meta };
  });
}

function initials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]).join("").toUpperCase() || "OP";
}

const EXCLUDED_STEP_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "status",
  "title",
  "label",
  "name",
  "description",
  "summary",
  "excerpt",
  "rationale",
  "content",
  "format",
  "channel",
  "audience",
  "icon",
  "meta",
]);

function buildBlueprintSteps(plan: Record<string, unknown> | null): BlueprintStep[] {
  return planItems(plan).map((item, i) => {
    if (typeof item === "string") {
      return { monogram: initials(item), title: item, audience: null, length: null, excerpt: null, tags: [] };
    }
    const obj = asObject(item);
    const title = strField(obj, ["title", "label", "name"]) ?? `Output ${i + 1}`;
    const audienceRaw = strField(obj, ["format", "channel", "audience"]);
    const audience =
      audienceRaw && audienceRaw in FORMAT_LABEL
        ? FORMAT_LABEL[audienceRaw as keyof typeof FORMAT_LABEL]
        : audienceRaw;
    const statusRaw = strField(obj, ["status"]);
    const length = statusRaw ? statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1) : null;
    const excerptRaw = strField(obj, ["excerpt", "description", "summary", "rationale", "content"]);
    const excerpt = excerptRaw
      ? excerptRaw.length > 220
        ? `${excerptRaw.slice(0, 220)}…`
        : excerptRaw
      : null;
    const tags = Object.entries(obj)
      .filter(
        ([k, v]) =>
          !EXCLUDED_STEP_KEYS.has(k) && typeof v === "string" && v.trim() && v.length <= 80,
      )
      .slice(0, 3)
      .map(([k, v]) => ({ icon: "label", label: `${k}: ${v as string}` }));
    return { monogram: initials(title), title, audience, length, excerpt, tags };
  });
}

export default async function Page() {
  const [sources, runs, ideas, jobs] = await Promise.all([
    getSourcesWithOutputs(50),
    getAgentRuns(20),
    getRecentIdeas(50),
    getDistributionJobs(50),
  ]);

  const latestRun = runs[0] ?? null;
  const outputCount = sources.reduce((n, s) => n + (s.outputs?.length ?? 0), 0);
  const pipelineStages = latestRun?.plan
    ? buildStages(latestRun.plan)
    : sourceLifecycleStages(sources);
  const blueprintSteps = buildBlueprintSteps(latestRun?.plan ?? null);

  return (
    <div className="flex flex-col w-full">
      <WorkspaceHeader sources={sources} runs={runs} />
      <PipelineGraph stages={pipelineStages} runStatus={latestRun?.status ?? null} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg mb-space-lg">
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <PlanBlueprint steps={blueprintSteps} runStatus={latestRun?.status ?? null} />
        </div>
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <IngestionTelemetry sources={sources} runs={runs} jobs={jobs} />
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px] text-secondary">speed</span>
                <div>
                  <p className="font-caption-bold text-caption-bold text-on-surface">
                    Agent Run Overview
                  </p>
                  <p className="font-body-sm text-[12px] text-secondary">
                    {latestRun
                      ? `${latestRun.status ?? "Run recorded"} • ${timeAgo(latestRun.created_at)}`
                      : "No agent runs yet"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {outputCount}
                </span>
                <span className="font-label-caps text-[10px] text-secondary block uppercase">
                  {outputCount === 1 ? "Output Generated" : "Outputs Generated"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AngleReservoir ideas={ideas} />
    </div>
  );
}