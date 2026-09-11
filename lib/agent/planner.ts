// Agentic V1 planner: ONE Gemini call converts a transcript into a structured
// Content Plan (3–7 angles, each with topic, suggested formats, pull-quotes,
// and rationale). Deliberately NOT a multi-agent swarm — per the grounded
// roadmap, a single planning call is enough for V1 and the planning step is
// what's being validated, not a supervisor graph.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { retryOnOverload } from "@/lib/ai/retry";
import { log } from "@/lib/logger";
import { getUserBrandVoice } from "@/lib/agent/memory";
import type { ContentPlan, OutputFormat } from "@/types/agent";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-3.6-flash";

const OUTPUT_FORMATS: OutputFormat[] = ["linkedin_post", "newsletter", "shortform_script", "thread", "carousel"];

// Hard grammar from the prompt. If the model ignores it, the parser rejects.
const SYSTEM_PROMPT = `You are the content strategist half of an agentic repurposing tool.
You read a long-form transcript (podcast, video, talk) and produce a content plan:
3 to 7 distinct angles that a creator could repurpose this recording into.

Rules:
- Each angle must be genuinely distinct in audience hook, not three re-wordings of one idea.
- For each angle give: title (a working hook the creator would recognise), a 1-2 sentence
  description of the piece, 1-3 suggested output formats from
  [linkedin_post, newsletter, shortform_script, thread, carousel] that fit that angle best,
  0-2 short pull-quotes taken VERBATIM from the transcript (no paraphrase),
  and a one-line rationale for why the angle works.
- Prefer concrete moments, numbers, and unusual claims over generic themes.
- Return ONLY valid JSON matching this TypeScript type:

type ContentIdea = {
  title: string;
  description: string;
  suggestedFormats: Array<"linkedin_post"|"newsletter"|"shortform_script"|"thread"|"carousel">;
  quotes: string[];
  rationale: string;
};

type ContentPlan = {
  summary: string;
  angles: ContentIdea[];
};`;

export type PlannerResult = {
  plan: ContentPlan;
  inputTokens: number;
  outputTokens: number;
};

// Strips markdown fences the model likes to add around JSON.
function unwrapJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function isOutputFormat(v: unknown): v is OutputFormat {
  return typeof v === "string" && (OUTPUT_FORMATS as string[]).includes(v);
}

function validatePlan(raw: unknown): ContentPlan {
  if (typeof raw !== "object" || raw === null) throw new Error("Planner returned non-object JSON.");
  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" ? obj.summary : "";
  if (!Array.isArray(obj.angles)) throw new Error("Planner returned no angles array.");

  const angles = obj.angles.map((a, i) => {
    const angle = a as Record<string, unknown>;
    if (typeof angle !== "object" || angle === null) throw new Error(`Angle ${i} is not an object.`);
    const title = typeof angle.title === "string" ? angle.title.trim() : "";
    if (!title) throw new Error(`Angle ${i} has no title.`);
    const formats = Array.isArray(angle.suggestedFormats)
      ? angle.suggestedFormats.filter(isOutputFormat)
      : [];
    if (formats.length === 0) throw new Error(`Angle ${i} has no supported formats.`);
    const quotes = Array.isArray(angle.quotes) ? angle.quotes.filter((q): q is string => typeof q === "string") : [];
    return {
      title,
      description: typeof angle.description === "string" ? angle.description : "",
      suggestedFormats: formats.slice(0, 3) as OutputFormat[],
      quotes: quotes.slice(0, 2),
      rationale: typeof angle.rationale === "string" ? angle.rationale : ""
    };
  });

  if (angles.length < 1 || angles.length > 7) {
    throw new Error(`Planner returned ${angles.length} angles (need 1-7).`);
  }

  return { summary, angles };
}

// Brand voice is layered into the planning prompt (Stage 2 memory), so angles
// land in the creator's voice instead of generic marketer-speak.
export async function planContent(
  transcript: string,
  brandVoice?: { tone: string; forbiddenPhrases: string[]; examples: string[] }
): Promise<PlannerResult> {
  const startedAt = Date.now();

  let voiceBlock = "";
  if (brandVoice) {
    const parts = [
      brandVoice.tone ? `Tone: ${brandVoice.tone}` : null,
      brandVoice.forbiddenPhrases.length
        ? `Avoid these phrases: ${brandVoice.forbiddenPhrases.join(", ")}`
        : null,
      brandVoice.examples.length
        ? `Voice samples (mirror their register):\n${brandVoice.examples.map((e) => `- ${e}`).join("\n")}`
        : null
    ].filter(Boolean);
    if (parts.length) voiceBlock = `\n\nBrand voice — filter every angle through this:\n${parts.join("\n")}`;
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT + voiceBlock,
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json"
    }
  });

  const result = await retryOnOverload(() =>
    model.generateContent(`Transcript:\n\n${transcript.slice(0, 22000)}`)
  );

  const raw = unwrapJson(result.response.text());
  const plan = validatePlan(JSON.parse(raw));

  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const usage = result.response.usageMetadata;
    inputTokens = usage?.promptTokenCount ?? 0;
    outputTokens = usage?.candidatesTokenCount ?? 0;
  } catch {
    // Usage metadata is optional; treat as unknown (0).
  }

  log.info("agent.planner_ok", {
    angles: plan.angles.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: Date.now() - startedAt
  });

  return { plan, inputTokens, outputTokens };
}

// Thin async wrapper around the sync planner from tools (keeps the DB fetch out
// of planner.ts so it stays testable without Supabase).
export async function loadBrandVoiceFor(userId: string) {
  const pref = await getUserBrandVoice(userId);
  return pref;
}