import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { retryOnOverload } from "@/lib/ai/retry";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Synthesizes a reusable brand-voice description from the user's REAL drafts.
// Honest by construction: it reads the user's own outputs (RLS), requires at
// least a couple of usable samples, and NEVER auto-saves — the client pastes
// the result into the voice box for the user to review and save.

const ANALYZE_MODEL = "gemini-3.6-flash";
const MAX_SAMPLES = 6;
const SAMPLE_CHARS = 2600;
const MAX_RESULT_CHARS = 2400;

const SYSTEM_INSTRUCTION = `You are VervAI's voice assistant. From the user's existing drafts, write ONE reusable brand-voice description they can paste into their settings.

Output ONLY the voice description as clean prose, 80-160 words. Capture their tone, personality, grammar tics, how they refer to themselves, and words they would avoid. Be concrete and specific to the provided samples.

If the samples are empty, too few, or unusable, reply with exactly: NOT_ENOUGH_DATA
Never mention assistants, models, or generation mechanics. No markdown, headers, bullets, or filler.`;

type OutputRow = { format: string; content: string | null };
type SourceRow = { title: string | null; outputs: OutputRow[] | null };

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: sources } = await supabase
    .from("sources")
    .select("title, outputs(content, format)")
    .eq("user_id", user.id)
    .in("status", ["done", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  // Newest usable drafts first; cap samples so a big library still fits the
  // prompt budget.
  const samples: string[] = [];
  for (const s of (sources ?? []) as SourceRow[]) {
    for (const o of s.outputs ?? []) {
      const body = (o.content ?? "").trim();
      if (!body) continue;
      samples.push(`Draft — ${s.title ?? "untitled source"} (${o.format})\n\n${body.slice(0, SAMPLE_CHARS)}`);
      if (samples.length >= MAX_SAMPLES) break;
    }
    if (samples.length >= MAX_SAMPLES) break;
  }

  if (samples.length < 2) {
    return NextResponse.json({ ok: false, code: "NOT_ENOUGH_DATA", samples: samples.length });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  const model = genAI.getGenerativeModel({
    model: ANALYZE_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION
  });

  const startedAt = Date.now();
  try {
    const result = await retryOnOverload(() => model.generateContent(samples.join("\n\n---\n\n")));
    const text = result.response.text().trim();
    if (!text || text === "NOT_ENOUGH_DATA") {
      return NextResponse.json({ ok: false, code: "NOT_ENOUGH_DATA", samples: samples.length });
    }
    log.info("prompts.analyze_voice_ok", {
      user_id: user.id,
      samples: samples.length,
      duration_ms: Date.now() - startedAt
    });
    return NextResponse.json({ ok: true, voice: text.slice(0, MAX_RESULT_CHARS) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not analyze your content.";
    log.error("prompts.analyze_voice_failed", err instanceof Error ? err : new Error(message), {
      user_id: user.id
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}