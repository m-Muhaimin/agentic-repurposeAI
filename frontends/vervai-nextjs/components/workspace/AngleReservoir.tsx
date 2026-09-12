import { timeAgo, type IdeaRow } from "@/lib/data";
import IdeaApproveButton from "@/components/workspace/IdeaApproveButton";

export default function AngleReservoir({ ideas }: { ideas: IdeaRow[] }) {
  const count = ideas.length;
  return (
    <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm mb-space-md">
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Candidate Angle Reservoir
          </h3>
          <p className="font-body-sm text-body-sm text-secondary">
            {count > 0
              ? `${count} angle${count === 1 ? "" : "s"} surfaced by the agent from ingested sources`
              : "Angles detected from ingested sources appear here."}
          </p>
        </div>
        <button
          className="font-caption-bold text-caption-bold text-primary hover:text-primary-container transition-colors flex items-center gap-1 self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span>View Full Transcription Analysis</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
      {ideas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {ideas.map((idea, i) => {
            const approved = idea.approved;
            const formatCount = idea.suggested_formats.length;
            const formatLabel =
              formatCount > 0
                ? `${formatCount} ${formatCount === 1 ? "format" : "formats"}`
                : "No formats proposed";
            return (
              <div
                key={idea.id}
                className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-space-xs">
                    <span
                      className={`font-label-caps text-[10px] uppercase font-bold ${approved ? "text-primary" : "text-secondary"}`}
                    >
                      Angle {String(i + 1).padStart(2, "0")} • {approved ? "Approved" : "Candidate"}
                    </span>
                    <span className="font-label-caps text-[10px] text-secondary">
                      {formatLabel}
                    </span>
                  </div>
                  <p className="font-caption-bold text-caption-bold text-on-surface mb-1">
                    {idea.title}
                  </p>
                  <p className="font-body-sm text-[12px] text-on-surface-variant line-clamp-2">
                    {idea.rationale ?? idea.description ?? "No rationale recorded for this angle."}
                  </p>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between">
                  <span className="font-label-caps text-[10px] text-secondary">
                    {approved ? "Included in plan" : `Surfaced ${timeAgo(idea.created_at)}`}
                  </span>
                  {approved ? (
                    <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                  ) : (
                    <IdeaApproveButton ideaId={idea.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
          No candidate angles yet. Once sources are transcribed, the agent surfaces narrative hooks
          here.
        </div>
      )}
    </section>
  );
}