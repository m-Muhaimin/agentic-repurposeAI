import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ExportData = {
  exportedAt: string;
  userId: string;
  sources: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  prompts: Array<Record<string, unknown>>;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [sourcesResult, outputsResult, jobsResult, promptsResult] = await Promise.all([
    supabase.from("sources").select("*").eq("user_id", user.id),
    supabase.from("outputs").select("*").eq("user_id", user.id),
    supabase.from("jobs").select("*").eq("user_id", user.id),
    supabase.from("user_prompts").select("*").eq("user_id", user.id)
  ]);

  if (sourcesResult.error) return NextResponse.json({ error: sourcesResult.error.message }, { status: 500 });

  const payload: ExportData = {
    exportedAt: new Date().toISOString(),
    userId: user.id,
    sources: sourcesResult.data ?? [],
    outputs: outputsResult.data ?? [],
    jobs: jobsResult.data ?? [],
    prompts: promptsResult.data ?? []
  };

  return NextResponse.json(payload);
}
