import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/app-shell";
import { Card } from "@/components/card";
import StatusBadge from "@/components/status-badge";
import OutputEditor from "@/components/output-editor";

const FORMAT_LABEL: Record<string, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter section",
  shortform_script: "Short-form script"
};

export default async function RepurposePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: output } = await supabase
    .from("outputs")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!output) notFound();

  const { data: source } = await supabase
    .from("sources")
    .select("id, title, status")
    .eq("id", output.source_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const createdAt = new Date(output.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const editedAt =
    output.updated_at && output.updated_at !== output.created_at
      ? new Date(output.updated_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric"
        })
      : null;

  return (
    <AppShell>
      <div className="workspace py-8 lg:py-10">
        <Link
          href="/library"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-theme-text-secondary transition-colors hover:text-theme-text-primary"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to content library
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-theme-divider px-6 py-5">
            <div className="min-w-0">
              <p className="caption uppercase tracking-wider text-primary-500">
                {FORMAT_LABEL[output.format] ?? output.format}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-bold">
                {source?.title ?? "Generated output"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="badge bg-neutral-100 text-neutral-700">
                  {createdAt}
                </span>
                {editedAt && (
                  <span className="badge bg-neutral-100 text-neutral-700">
                    Edited {editedAt}
                  </span>
                )}
                {source && (
                  <StatusBadge status={source.status} />
                )}
              </div>
            </div>
          </div>

          <OutputEditor outputId={output.id} initialContent={output.content} />
        </Card>
      </div>
    </AppShell>
  );
}