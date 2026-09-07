import Link from "next/link";
import { Card, CardHeader } from "@/components/card";

// "What your agent knows" — assembled server-side in app/agent/page.tsx from
// real, user-scoped counts. Everything here is honest: brand voice presence,
// drafts (not "published posts"), ready sources, strategy plans on file, and a
// publishing/audience row that clearly says when nothing is connected yet.

export interface AgentContextData {
  readySources: number;
  totalSources: number;
  libraryDrafts: number;
  brandVoiceSet: boolean;
  strategyPlans: number;
  publishingConnected: boolean;
}

function Value({ text, kind }: { text: string; kind: "set" | "default" | "none" }) {
  return (
    <span
      className={`badge ${
        kind === "set"
          ? "bg-neutral-900 text-white"
          : kind === "default"
            ? "bg-primary-100 text-primary-500"
            : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {text}
    </span>
  );
}

export default function AgentContextStrip({ context }: { context: AgentContextData }) {
  const draftWord = context.libraryDrafts === 1 ? "draft" : "drafts";

  return (
    <Card>
      <CardHeader
        title="What your agent knows"
        description="Context it works from — every figure is read from your account."
      />
      <dl className="divide-y divide-theme-divider text-xs">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Brand voice</dt>
          <dd>
            {context.brandVoiceSet ? (
              <Value text="Set" kind="set" />
            ) : (
              <Value text="Using defaults" kind="default" />
            )}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Content library</dt>
          <dd className="flex items-center gap-2">
            <Value text={`${context.libraryDrafts} ${draftWord}`} kind={context.libraryDrafts > 0 ? "set" : "none"} />
            <Link href="/library" className="text-primary-500 hover:text-primary-700">
              Open library
            </Link>
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Source recordings</dt>
          <dd className="flex items-center gap-2">
            <Value
              text={`${context.readySources} of ${context.totalSources} ready`}
              kind={context.readySources > 0 ? "set" : "none"}
            />
            <Link href="/upload" className="text-primary-500 hover:text-primary-700">
              Add source
            </Link>
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Strategy plans on file</dt>
          <dd>
            <Value
              text={context.strategyPlans > 0 ? `${context.strategyPlans} plan${context.strategyPlans === 1 ? "" : "s"}` : "None yet"}
              kind={context.strategyPlans > 0 ? "set" : "none"}
            />
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Performance</dt>
          <dd className="flex items-center gap-2">
            {context.publishingConnected ? (
              <Value text="Connected" kind="set" />
            ) : (
              <Value text="Needs a channel" kind="none" />
            )}
            <Link href="/connections" className="text-primary-500 hover:text-primary-700">
              {context.publishingConnected ? "Manage" : "Connect"}
            </Link>
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <dt className="text-theme-text-secondary">Audience</dt>
          <dd className="flex items-center gap-2">
            <Value text="Not connected yet" kind="none" />
            <Link href="/connections" className="text-primary-500 hover:text-primary-700">
              Connect
            </Link>
          </dd>
        </div>
      </dl>
    </Card>
  );
}