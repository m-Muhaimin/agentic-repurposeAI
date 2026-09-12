import type { SourceRow, OutputRow, IdeaRow } from "@/lib/data";
import { FORMAT_LABEL, SOURCE_TYPE_META } from "@/lib/data";

type Props = {
  sources: SourceRow[];
  outputs: OutputRow[];
  publishedCount: number;
  ideas: IdeaRow[];
};

export default function QuotaMonitors({
  sources,
  outputs,
  publishedCount,
  ideas,
}: Props) {
  const totalSources = sources.length;
  const totalOutputs = outputs.length;
  const totalIdeas = ideas.length;
  const approvedIdeas = ideas.filter((i) => i.approved).length;

  const typeCounts = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.source_type] = (acc[s.source_type] ?? 0) + 1;
    return acc;
  }, {});

  const formatCounts = outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.format] = (acc[o.format] ?? 0) + 1;
    return acc;
  }, {});

  const doneCount = sources.filter((s) => s.status === "done").length;
  const processingCount = sources.filter(
    (s) => s.status !== "done" && s.status !== "failed",
  ).length;
  const failedCount = sources.filter((s) => s.status === "failed").length;

  if (totalSources === 0 && totalOutputs === 0 && totalIdeas === 0) {
    return (
      <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-lg mb-space-lg text-center">
        <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">
          inbox
        </span>
        <p className="font-body-sm text-body-sm text-secondary">
          No usage data yet. Ingest your first source to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-space-lg">
      <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center gap-2 mb-space-xs">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">
                database
              </span>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase text-outline">
                Sources
              </p>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Ingested
              </h2>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {totalSources}
            </span>
            <span className="font-headline-md text-headline-md text-secondary">
              total
            </span>
          </div>
        </div>
        <div className="mt-5 pt-3 bg-surface-container-low rounded-lg p-space-sm space-y-1.5">
          <p className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
            By Type
          </p>
          {Object.entries(typeCounts).map(([type, count]) => (
            <div
              key={type}
              className="flex justify-between font-body-sm text-body-sm text-on-surface items-center"
            >
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  {SOURCE_TYPE_META[type as keyof typeof SOURCE_TYPE_META]
                    ?.icon ?? "description"}
                </span>
                {SOURCE_TYPE_META[type as keyof typeof SOURCE_TYPE_META]
                  ?.label ?? type}
              </span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
          {Object.keys(typeCounts).length === 0 && (
            <p className="font-body-sm text-body-sm text-secondary italic">
              No sources yet
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center gap-2 mb-space-xs">
            <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[20px]">
                speed
              </span>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase text-outline">
                Outputs
              </p>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Generated
              </h2>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {totalOutputs}
            </span>
            <span className="font-headline-md text-headline-md text-secondary">
              total
            </span>
          </div>
        </div>
        <div className="mt-5 pt-3 bg-surface-container-low rounded-lg p-space-sm space-y-1.5">
          <p className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
            By Format
          </p>
          {Object.entries(formatCounts).map(([format, count]) => (
            <div
              key={format}
              className="flex justify-between font-body-sm text-body-sm text-on-surface"
            >
              <span>
                {FORMAT_LABEL[format as keyof typeof FORMAT_LABEL] ?? format}
              </span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
          {Object.keys(formatCounts).length === 0 && (
            <p className="font-body-sm text-body-sm text-secondary italic">
              No outputs yet
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center gap-2 mb-space-xs">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">
                send
              </span>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase text-outline">
                Distribution
              </p>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Published
              </h2>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {publishedCount}
            </span>
            <span className="font-headline-md text-headline-md text-secondary">
              posts live
            </span>
          </div>
        </div>
        <div className="mt-5 pt-3 bg-surface-container-low rounded-lg p-space-sm space-y-1.5">
          <p className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
            Pipeline Status
          </p>
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface">
            <span>Sources ready</span>
            <span className="font-semibold">{doneCount}</span>
          </div>
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface">
            <span>In progress</span>
            <span className="font-semibold">{processingCount}</span>
          </div>
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface">
            <span>Failed</span>
            <span className="font-semibold">{failedCount}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md flex flex-col justify-between hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center gap-2 mb-space-xs">
            <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[20px]">
                lightbulb
              </span>
            </div>
            <div>
              <p className="font-label-caps text-label-caps uppercase text-outline">
                Content
              </p>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Ideas
              </h2>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {totalIdeas}
            </span>
            <span className="font-headline-md text-headline-md text-secondary">
              proposed
            </span>
          </div>
        </div>
        <div className="mt-5 pt-3 bg-surface-container-low rounded-lg p-space-sm space-y-1.5">
          <p className="font-label-caps text-[10px] text-outline uppercase tracking-wider">
            Approval
          </p>
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface">
            <span>Approved</span>
            <span className="font-semibold">{approvedIdeas}</span>
          </div>
          <div className="flex justify-between font-body-sm text-body-sm text-on-surface">
            <span>Pending review</span>
            <span className="font-semibold">{totalIdeas - approvedIdeas}</span>
          </div>
        </div>
      </div>
    </div>
  );
}