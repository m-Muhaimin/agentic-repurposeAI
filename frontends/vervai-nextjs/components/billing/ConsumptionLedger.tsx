import type { SourceRow } from "@/lib/data";
import { SOURCE_TYPE_META, formatDate } from "@/lib/data";

type Props = {
  sources: SourceRow[];
};

type LedgerRow = {
  id: string;
  timestamp: string;
  artifactIcon: string;
  artifactIconClass: string;
  artifact: string;
  taskBadge: string;
  taskBadgeClass: string;
  taskDetail: string;
  count: string;
  countClass: string;
};

export default function ConsumptionLedger({ sources }: Props) {
  const rows: LedgerRow[] = [];

  for (const source of sources) {
    const outputCount = (source.outputs ?? []).length;
    const typeMeta = SOURCE_TYPE_META[source.source_type];
    rows.push({
      id: `source-${source.id}`,
      timestamp: formatDate(source.created_at),
      artifactIcon: typeMeta?.icon ?? "description",
      artifactIconClass: "text-primary",
      artifact: source.title,
      taskBadge: typeMeta?.label ?? source.source_type,
      taskBadgeClass: "bg-primary-fixed text-on-primary-fixed",
      taskDetail:
        outputCount > 0 ? `${outputCount} output${outputCount === 1 ? "" : "s"}` : "Processing",
      count:
        outputCount > 0 ? `${outputCount} output${outputCount === 1 ? "" : "s"}` : "—",
      countClass: outputCount > 0 ? "text-on-surface" : "text-secondary",
    });
  }

  const displayedRows = rows.slice(0, 10);

  return (
    <div
      className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col"
      id="ledger"
    >
      <div className="p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-low/40">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-xs">
            <h3 className="font-headline-lg text-headline-lg text-on-surface">
              Source Activity Log
            </h3>
            <span className="font-caption-bold text-caption-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
              {rows.length} sources
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Record of ingested sources and generated outputs.
          </span>
        </div>
      </div>
      {displayedRows.length === 0 ? (
        <div className="py-12 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline mb-2 block">
            inbox
          </span>
          <p className="font-body-sm text-body-sm text-secondary">
            No sources ingested yet. Upload your first source to see activity
            here.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
                <th className="py-space-sm px-space-lg font-semibold">Date</th>
                <th className="py-space-sm px-space-md font-semibold">
                  Source
                </th>
                <th className="py-space-sm px-space-md font-semibold">Type</th>
                <th className="py-space-sm px-space-md font-semibold text-right">
                  Outputs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface font-body-sm text-body-sm">
              {displayedRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-surface-container-low/60 transition-colors"
                >
                  <td className="py-space-md px-space-lg whitespace-nowrap text-on-surface-variant font-caption-bold">
                    {row.timestamp}
                  </td>
                  <td className="py-space-md px-space-md">
                    <div className="flex items-center gap-space-xs">
                      <span
                        className={`material-symbols-outlined text-[18px] ${row.artifactIconClass}`}
                      >
                        {row.artifactIcon}
                      </span>
                      <span className="font-body-medium text-body-medium text-on-surface truncate max-w-[250px]">
                        {row.artifact}
                      </span>
                    </div>
                  </td>
                  <td className="py-space-md px-space-md whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded font-caption-bold text-caption-bold ${row.taskBadgeClass}`}
                    >
                      {row.taskBadge}
                    </span>
                    <span className="text-on-surface-variant text-[11px] ml-1.5">
                      {row.taskDetail}
                    </span>
                  </td>
                  <td
                    className={`py-space-md px-space-md whitespace-nowrap text-right font-headline-sm text-headline-sm ${row.countClass}`}
                  >
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {displayedRows.length > 0 ? (
        <div className="p-space-md bg-surface-container-low/60 flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
          <span>
            Showing {displayedRows.length} of {rows.length} sources
          </span>
        </div>
      ) : null}
    </div>
  );
}