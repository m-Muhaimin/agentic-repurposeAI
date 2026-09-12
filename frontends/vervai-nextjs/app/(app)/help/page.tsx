import QuickstartWorkflows from "@/components/help/QuickstartWorkflows";
import DagPipeline from "@/components/help/DagPipeline";
import VoiceTonePanel from "@/components/help/VoiceTonePanel";
import ApiExtensibilityPanel from "@/components/help/ApiExtensibilityPanel";
import ChangelogPanel from "@/components/help/ChangelogPanel";
import SearchInput from "@/components/ui/SearchInput";

const FREQUENT_QUERIES = [
  { icon: "graphic_eq", iconClass: "text-primary", label: "Speaker Diarization" },
  { icon: "inventory_2", iconClass: "text-tertiary", label: "Output Registry" },
  { icon: "webhook", iconClass: "text-secondary", label: "Custom Webhooks" },
  { icon: "tune", iconClass: "text-primary-container", label: "Brand Tone" },
];

export default function Page() {
  return (
    <div className="flex flex-col w-full">
      <div className="px-space-lg py-space-md flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
          <span className="hover:text-primary transition-colors cursor-pointer">Workspace</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-body-medium text-body-medium">
            Documentation & Knowledge Base
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface font-caption-bold text-caption-bold">
            <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
            <span>Read-only Documentation</span>
          </div>
          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-medium text-body-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" disabled title="Coming soon">
            <span className="material-symbols-outlined text-[16px] text-primary">download</span>
            <span>PDF Schemas</span>
          </button>
        </div>
      </div>
      <div className="px-space-lg pt-space-xs pb-space-lg">
        <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm p-space-lg md:p-space-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary-fixed/40 via-transparent to-transparent pointer-events-none -mr-24 -mt-24 rounded-full blur-2xl"></div>
          <div className="relative z-10 max-w-4xl flex flex-col gap-space-sm">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold uppercase tracking-wider">
                Engineering Codex
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Documentation & Knowledge Base
            </h1>
            <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl">
              Architecture guides, autonomous agent workflows, prompt tuning, and deterministic API
              relays for the VervAI multi-modal execution mesh.
            </p>
            <div className="mt-space-md w-full relative">
              <div className="relative flex items-center">
                <SearchInput
                  placeholder="Search documentation, API endpoints, SDK references, guides (⌘K)..."
                  className="[&_input]:h-14 [&_input]:pl-12 [&_input]:pr-28 [&_input]:rounded-xl [&_input]:bg-surface-container-low [&_input]:focus:bg-surface-container-lowest [&_input]:text-on-surface [&_input]:font-body-base [&_input]:text-body-base [&_input]:placeholder:text-on-surface-variant [&_input]:shadow-sm [&_input]:focus:shadow-md"
                />
                <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
                  <kbd className="px-2 py-1 rounded bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold shadow-sm">
                    ⌘K
                  </kbd>
                </div>
              </div>
              <div className="mt-space-sm flex flex-wrap items-center gap-space-xs">
                <span className="font-caption-bold text-caption-bold text-on-surface-variant uppercase mr-1">
                  Frequent Queries:
                </span>
                {FREQUENT_QUERIES.map((query) => (
                  <button
                    key={query.label}
                    className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-caption-bold text-caption-bold transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    disabled
                    title="Coming soon"
                  >
                    <span className={`material-symbols-outlined text-[14px] ${query.iconClass}`}>
                      {query.icon}
                    </span>
                    <span>{query.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-space-lg pb-space-xl grid grid-cols-1 md:grid-cols-12 gap-space-lg">
        <QuickstartWorkflows />
        <DagPipeline />
        <VoiceTonePanel />
        <ApiExtensibilityPanel />
        <ChangelogPanel />
        <div className="md:col-span-12 rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between p-space-lg gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">support_agent</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Need help with your workspace?
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Search the knowledge base above, or reach the support team for pipeline and
                integration questions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm shrink-0 w-full md:w-auto justify-end">
            <span className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-body-medium text-body-medium flex items-center gap-2 transition-colors cursor-default">
              <span className="material-symbols-outlined text-[18px]">forum</span>
              <span>Community Forum</span>
            </span>
            <span className="px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-body-medium text-body-medium flex items-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-default">
              <span className="material-symbols-outlined text-[18px]">headset_mic</span>
              <span>Contact Support</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}