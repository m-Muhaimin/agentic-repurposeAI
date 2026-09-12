type ApprovalStatus =
  | { kind: "pending"; label: string }
  | { kind: "published"; label: string }
  | { kind: "neutral"; label: string };

type LineageRow = {
  fileName: string;
  fileMeta: string;
  icon: string;
  iconTone: "secondary" | "error" | "fixed";
  ingestedAt: string;
  outputCount: string;
  outputBreakdown: string;
  approval: ApprovalStatus;
  toneScore: string;
};

function FileIconTile({ row }: { row: LineageRow }) {
  const toneClass =
    row.iconTone === "secondary"
      ? "bg-secondary-container text-on-secondary-container"
      : row.iconTone === "error"
        ? "bg-error-container text-on-error-container"
        : "bg-secondary-fixed text-on-secondary-fixed";
  return (
    <span className={`w-7 h-7 rounded ${toneClass} flex items-center justify-center`}>
      <span className="material-symbols-outlined text-[16px]">{row.icon}</span>
    </span>
  );
}

function ApprovalPill({ approval }: { approval: ApprovalStatus }) {
  if (approval.kind === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-caption-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>{approval.label}</span>
      </span>
    );
  }
  if (approval.kind === "published") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-tertiary text-[11px] font-caption-bold">
        <span className="material-symbols-outlined text-[12px]">check_circle</span>
        <span>{approval.label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-caption-bold">
      <span>{approval.label}</span>
    </span>
  );
}

export default function SourceLineageTable({ rows }: { rows: LineageRow[] }) {
  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm space-y-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface">
            Recent Source Lineage &amp; Batch Traceability
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            Track how each raw source node bifurcates into active cross-channel distribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-caption-bold text-caption-bold hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Bulk Export</span>
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-caption-bold text-caption-bold hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Batch Action</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-secondary font-label-caps text-label-caps uppercase tracking-wider">
              <th className="py-2.5 px-3 rounded-l-lg">Raw Source Node</th>
              <th className="py-2.5 px-3">Ingestion Date</th>
              <th className="py-2.5 px-3">Generated Assets</th>
              <th className="py-2.5 px-3">Approval Status</th>
              <th className="py-2.5 px-3">Source Status</th>
              <th className="py-2.5 px-3 rounded-r-lg text-right">Lineage Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-body-sm text-body-sm">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.fileName} className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <FileIconTile row={row} />
                      <div>
                        <p className="font-caption-bold text-caption-bold text-on-surface">
                          {row.fileName}
                        </p>
                        <p className="text-[11px] text-secondary">{row.fileMeta}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-secondary font-medium">{row.ingestedAt}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-caption-bold text-on-surface">{row.outputCount}</span>
                      <span className="text-outline text-xs">/</span>
                      <span className="text-secondary text-[12px]">{row.outputBreakdown}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <ApprovalPill approval={row.approval} />
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-caption-bold text-caption-bold text-tertiary">
                      {row.toneScore}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                      disabled
                      title="Coming soon"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-3 text-center text-secondary font-body-sm text-body-sm"
                >
                  No sources ingested yet — upload a source to populate lineage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}