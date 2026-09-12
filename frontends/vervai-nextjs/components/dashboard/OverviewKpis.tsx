import type { ReactNode } from "react";
import Panel from "@/components/ui/Panel";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";

export type KpiRow = {
  icon: string;
  label: string;
  value: string;
};

export type Kpi = {
  label: string;
  icon: string;
  iconTone?: string;
  value: string;
  unit: string;
  description: string;
  progress?: number;
  rows?: KpiRow[];
  footerLeft: ReactNode;
  footerRight: ReactNode;
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <Panel>
      <div>
        <div className="flex items-center justify-between mb-space-sm">
          <span className="font-label-caps text-label-caps uppercase text-secondary">
            {kpi.label}
          </span>
          <Icon name={kpi.icon} size={18} className={kpi.iconTone ?? "text-outline"} />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-display-xl text-display-xl text-on-surface">{kpi.value}</span>
          <span className="font-caption-bold text-caption-bold text-secondary">{kpi.unit}</span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mb-space-md">{kpi.description}</p>
        {kpi.progress !== undefined && (
          <>
            <ProgressBar value={kpi.progress} className="mb-space-sm" />
            <div className="flex items-center justify-between text-xs text-secondary pt-1">
              <span className="font-body-sm text-[11px]">64 min remaining</span>
              <span className="font-caption-bold text-[11px] text-on-surface">Studio Pro Tier</span>
            </div>
          </>
        )}
        {kpi.rows && (
          <div className="space-y-2 pt-space-xs">
            {kpi.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-secondary flex items-center gap-1.5">
                  <Icon name={row.icon} size={14} />
                  {row.label}
                </span>
                <span className="font-caption-bold text-on-surface">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-space-md mt-space-md bg-surface-container-low -mx-space-lg -mb-space-lg px-space-lg py-2.5 rounded-b-xl flex items-center justify-between">
        <span className="font-label-caps text-[11px] text-secondary uppercase">
          {kpi.footerLeft}
        </span>
        <span className="font-caption-bold text-[12px] text-on-surface flex items-center gap-1">
          {kpi.footerRight}
        </span>
      </div>
    </Panel>
  );
}

export default function OverviewKpis({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}