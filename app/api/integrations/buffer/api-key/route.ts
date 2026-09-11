import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiKey, saveApiKey, deleteApiKey, isApiKeyColumnMissing } from "@/lib/buffer/connections";
import { log } from "@/lib/logger";

// /api/integrations/buffer/api-key — per-user Buffer API key management.
//
// The API key authenticates the MCP connector the agent uses for scheduling,
// repurpose-from-post and post metrics (publish.buffer.com/settings/api). It is
// encrypted at rest; this surface only ever reports whether one exists — the
// key itself never leaves the server. The manual "Send now" publish path stays
// OAuth-gated and is unaffected by this key.

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = await getApiKey(user.id);
  return NextResponse.json({ ok: true, hasApiKey: Boolean(apiKey) });
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });

  try {
    await saveApiKey(user.id, apiKey);
  } catch (err) {
    log.error("buffer.api_key_save_failed", err instanceof Error ? err : new Error(String(err)), { user_id: user.id });
    if (isApiKeyColumnMissing(err)) {
      return NextResponse.json(
        { error: "The Buffer scheduling migration isn't applied yet — run the 20260910000001 migration first." },
        { status: 503 }
      );
    }
    const message =
      err instanceof Error && /BUFFER_TOKEN_ENCRYPTION_KEY/i.test(err.message)
        ? "The Buffer encryption key isn't configured. Tell the admin to set BUFFER_TOKEN_ENCRYPTION_KEY on the server."
        : err instanceof Error
          ? `Could not save the Buffer API key: ${err.message}`
          : "Could not save the Buffer API key.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  log.info("buffer.api_key_saved", { user_id: user.id });
  return NextResponse.json({ ok: true, hasApiKey: true });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    await deleteApiKey(user.id);
  } catch (err) {
    log.error("buffer.api_key_delete_failed", err instanceof Error ? err : new Error(String(err)), { user_id: user.id });
    if (isApiKeyColumnMissing(err)) {
      return NextResponse.json(
        { error: "The Buffer scheduling migration isn't applied yet — run the 20260910000001 migration first." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? `Could not remove the Buffer API key: ${err.message}` : "Could not remove the Buffer API key." },
      { status: 500 }
    );
  }

  log.info("buffer.api_key_deleted", { user_id: user.id });
  return NextResponse.json({ ok: true, hasApiKey: false });
}