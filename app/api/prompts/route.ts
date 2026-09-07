import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PROMPT_KEYS, type PromptKey } from "@/lib/ai/prompts";
import { getUserPrompts, isPromptsTableUnavailable, type UserPromptMap } from "@/lib/prompts";

const MAX_PROMPT_LENGTH = 8000;

// Only reachable if the user_prompts migration in supabase/schema.sql hasn't
// been run on the project yet — surfaces a clear path forward instead of a raw
// PostgREST error.
const MIGRATION_HINT =
  "Custom prompts aren't live yet — the user_prompts table doesn't exist in this project. " +
  "Run the user_prompts migration from supabase/schema.sql in the Supabase SQL editor, then retry.";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const prompts = await getUserPrompts(user.id);

  const overrides: Record<string, string> = {};
  for (const key of PROMPT_KEYS) {
    if (key === "brand_voice") continue;
    const value = (prompts as UserPromptMap)[key];
    overrides[key] = value?.trim() ? value : "";
  }

  return NextResponse.json({ brand_voice: prompts.brand_voice ?? "", overrides });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { format?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { format, prompt } = body;
  if (typeof format !== "string" || !(PROMPT_KEYS as readonly string[]).includes(format)) {
    return NextResponse.json({ error: "Unknown format." }, { status: 400 });
  }
  if (typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt is too long — keep it under ${MAX_PROMPT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  if (!prompt.trim()) {
    // Empty prompt = restore the built-in default for this format.
    const { error } = await service
      .from("user_prompts")
      .delete()
      .eq("user_id", user.id)
      .eq("format", format);
    if (error) {
      if (isPromptsTableUnavailable(error)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, restored: true });
  }

  const trimmed = prompt.trim();
  const { error } = await service.from("user_prompts").upsert(
    {
      user_id: user.id,
      format,
      prompt: trimmed,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,format" }
  );
  if (error) {
    if (isPromptsTableUnavailable(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: { format, prompt: trimmed } });
}