import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/billing/entitlements";
import { getUsageSnapshot } from "@/lib/billing/usage";
import PageHeader from "@/components/page-header";
import SourceList from "./source-list";

export default async function LibraryPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: sources } = await supabase
    .from("sources")
    .select("*, outputs(*)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  // Beta plan measure shown while building the library — silently degrades if
  // the billing tables/migration are not live yet.
  let betaNote: string | null = "Beta plan — free during beta";
  try {
    const plan = await resolvePlan(user!.id);
    const snap = await getUsageSnapshot(user!.id, plan);
    betaNote =
      snap.jobsLimit === null
        ? `${plan.name} — free during beta`
        : `${snap.jobsUsed} of ${snap.jobsLimit} beta jobs used this ${snap.windowLabel} · ${snap.jobsRemaining ?? 0} left`;
  } catch {
    betaNote = "Beta plan — free during beta";
  }

  return (
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          title="Content Library"
          description={
            <>
              Everything you&apos;ve repurposed — sources, their drafts, and processing status — in
              one place.{" "}
              <Link href="/settings/usage" className="caption text-primary-500 transition-colors hover:text-primary-700">
                {betaNote} →
              </Link>
            </>
          }
          actions={
            <Link href="/upload" className="btn btn-primary">
              <span className="flex items-center gap-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Repurpose content
              </span>
            </Link>
          }
        />
        <SourceList initialSources={sources ?? []} userId={user!.id} />
      </div>
  );
}