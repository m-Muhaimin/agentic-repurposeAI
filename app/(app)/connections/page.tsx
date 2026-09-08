import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import { Card } from "@/components/card";
import ConnectionsYoutube from "@/components/connections-youtube";
import ConnectionsBuffer from "@/components/connections-buffer";

export default async function ConnectionsPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const params = searchParams;

  let connection: { channelTitle: string; createdAt: string } | null = null;
  try {
    const { data } = await supabase
      .from("youtube_connections")
      .select("channel_title, created_at")
      .eq("user_id", user!.id)
      .limit(1)
      .single();
    if (data) connection = { channelTitle: data.channel_title, createdAt: data.created_at };
  } catch {
    // No connection (or table missing) — the connect state is shown.
  }

  let bufferConnection: { bufferUsername: string; createdAt: string } | null = null;
  try {
    const { data } = await supabase
      .from("buffer_connections")
      .select("buffer_username, created_at")
      .eq("user_id", user!.id)
      .limit(1)
      .single();
    if (data) bufferConnection = { bufferUsername: data.buffer_username, createdAt: data.created_at };
  } catch {
    // No connection (or table missing) — the connect state is shown.
  }

  const bufferNotice: { kind: "success" | "error"; text: string } | null =
    params.success === "buffer"
      ? params.error
        ? params.error === "config"
          ? { kind: "error", text: "Buffer is not configured. Tell the admin to set BUFFER_CLIENT_ID/SECRET." }
          : { kind: "error", text: "Could not connect Buffer. Please try again." }
        : { kind: "success", text: "Buffer connected." }
      : null;

  return (
      <div className="workspace py-8 lg:py-10">
        <PageHeader
          className="mb-8"
          title="Connections"
          description="Connect the platforms where your content lives so RepurposeAI can work with it directly."
        />

        {bufferNotice && (
          <div
            role="status"
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              bufferNotice.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {bufferNotice.text}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ConnectionsYoutube connection={connection} />
          <ConnectionsBuffer connection={bufferConnection} />

          <Card className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge bg-neutral-100 text-neutral-600">Coming soon</span>
              </div>
              <h2 className="mt-3 font-display text-base font-semibold">Podcast</h2>
              <p className="mt-1 text-sm text-theme-text-secondary">
                Ingest new episodes straight from your podcast feed — no manual uploads.
              </p>
            </div>
          </Card>
        </div>
      </div>
  );
}