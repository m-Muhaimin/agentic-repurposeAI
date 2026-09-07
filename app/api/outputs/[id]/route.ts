import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_CONTENT_LENGTH = 100_000;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { content } = await request.json().catch(() => ({}));
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "Content is too long" }, { status: 400 });
  }

  const { data: output } = await supabase
    .from("outputs")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!output) return NextResponse.json({ error: "Output not found" }, { status: 404 });

  // `outputs` has no update RLS policy, so the service client is required here.
  const service = createServiceClient();
  const update = { content, updated_at: new Date().toISOString() };
  const { error } = await service.from("outputs").update(update).eq("id", params.id);
  if (error) {
    // The `updated_at` column may not exist yet if the schema migration wasn't
    // applied — retry without it so editing still works.
    if (/could not find the\s*\w*\s*["']?updated_at|column\s+[\w.]*\s*updated_at\s+does\s*(n'?t|not)?\s*exist|undefined_column|42703/i.test(error.message)) {
      const { error: fallbackError } = await service
        .from("outputs")
        .update({ content })
        .eq("id", params.id);
      if (fallbackError) {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}