import Panel from "@/components/ui/Panel";
import Icon from "@/components/ui/Icon";
import Tag, { type TagTone } from "@/components/ui/Tag";
import { ButtonLink } from "@/components/ui/Button";

export type Opportunity = {
  icon: string;
  iconTone: string;
  title: string;
  tagLabel: string;
  tagTone: TagTone;
  description: string;
};

function OpportunityRow({ opp }: { opp: Opportunity }) {
  return (
    <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-all flex items-start gap-space-md">
      <div
        className={`w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm ${opp.iconTone}`}
      >
        <Icon name={opp.icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-caption-bold text-caption-bold text-on-surface">{opp.title}</span>
          <Tag tone={opp.tagTone}>{opp.tagLabel}</Tag>
        </div>
        <p className="font-body-sm text-body-sm text-secondary leading-relaxed">{opp.description}</p>
      </div>
    </div>
  );
}

export default function AgentOpportunitiesPanel({
  opportunities,
  count,
}: {
  opportunities: Opportunity[];
  count: number;
}) {
  return (
    <Panel className="lg:col-span-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <h3 className="font-headline-lg text-headline-lg text-on-surface">Agent Opportunities</h3>
          </div>
          <Tag tone="primary" size="md">
            High Leverage
          </Tag>
        </div>
        <p className="font-body-medium text-body-medium text-secondary mb-space-md">
          {count} high-leverage content angles detected from your latest ingested sources.
        </p>
        {opportunities.length > 0 ? (
          <div className="space-y-space-sm">
            {opportunities.map((opp) => (
              <OpportunityRow key={opp.title} opp={opp} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No unlocked opportunities yet. Once sources are transcribed, the agent surfaces angles here.
          </div>
        )}
      </div>
      <div className="pt-space-md mt-space-sm">
        <ButtonLink href="/workspace" variant="secondary" size="md" className="w-full justify-between bg-surface-container text-on-surface hover:bg-surface-container-high shadow-sm">
          <span>Open Agent Workspace</span>
          <Icon name="north_east" size={16} />
        </ButtonLink>
      </div>
    </Panel>
  );
}