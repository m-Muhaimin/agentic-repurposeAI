import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: source } = await supabase
    .from("sources")
    .select("id, storage_path")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  const service = createServiceClient();

  if (source.storage_path) {
    // Storage has no DELETE policy for objects, so the service role is required.
    const { error: storageError } = await service.storage.from("sources").remove([source.storage_path]);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  // The jobs and outputs tables cascade on source delete, so one call cleans
  // up the source, its drafts, and any queued processing. Run through the
  // user-scoped client: the DELETE policy enforces ownership at the DB layer
  // in addition to the ownership check above.
  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}