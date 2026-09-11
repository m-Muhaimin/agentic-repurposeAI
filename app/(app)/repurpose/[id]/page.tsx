import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/card";
import StatusBadge from "@/components/status-badge";
import OutputEditor from "@/components/output-editor";
import Breadcrumbs from "@/components/breadcrumbs";

const FORMAT_LABEL: Record<string, string> = {
  linkedin_post: "LinkedIn post",
  newsletter: "Newsletter section",
  shortform_script: "Short-form script",
  thread: "Thread",
  carousel: "Carousel"
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
    <div className="workspace py-8 lg:py-10">
        <Breadcrumbs
          items={[
            { label: "Content library", href: "/library" },
            { label: source?.title ?? "Generated output" }
          ]}
        />

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
  );
}