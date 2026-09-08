import { PROMPTS, type OutputFormat } from "./prompts";

// Gemini's quota hits ~20 generateContent calls/day (see AGENTS.md). This is the
// fallback for when Gemini 429s. OpenRouter made the free variant of this model
// unavailable, so we default to the paid slug it recommends — set OPENROUTER_MODEL
// to override (e.g. a free model or a different provider/model).
const FALLBACK_MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";

export async function generateOutputViaOpenRouter(
  format: OutputFormat,
  transcript: string,
  systemPrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter asks for these so free-tier traffic can be attributed to your app.
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "VervAI"
    },
    body: JSON.stringify({
      model: FALLBACK_MODEL,
      messages: [
        { role: "system", content: systemPrompt ?? PROMPTS[format] },
        { role: "user", content: `Transcript:\n\n${transcript.slice(0, 15000)}` }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content.");
  return content as string;
}