import { createServiceClient } from "@/lib/supabase/server";
import { PROMPT_KEYS, type PromptKey } from "@/lib/ai/prompts";

// A user's custom prompts, keyed by PromptKey. An absent key means "use the
// built-in default for that format" (or "no brand voice" for brand_voice).
export type UserPromptMap = Partial<Record<PromptKey, string>>;

// Matches PostgREST/Supabase errors that mean the user_prompts table hasn't
// been created yet (schema.sql migration not run). Covers the pg-meta phrase
// ("Could not find the table 'public.user_prompts' in the schema cache"), the
// raw Postgres phrasing ("relation "public.user_prompts" does not exist"), and
// the underlying error codes, so a missing table degrades to defaults instead
// of breaking generation.
const MISSING_TABLE_PATTERN =
  /could not find the\s*\w*\s*["']?[\w.]*user_prompts|does\s*not\s*exist|PGRST205|42P01/i;

export function isPromptsTableUnavailable(err: unknown): boolean {
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    return MISSING_TABLE_PATTERN.test(typeof message === "string" ? message : String(err));
  }
  return err != null && MISSING_TABLE_PATTERN.test(String(err));
}

/**
 * Loads a user's custom prompts. If the user_prompts table doesn't exist yet
 * (migration not run), returns {} so callers fall back to defaults.
 */
export async function getUserPrompts(userId: string): Promise<UserPromptMap> {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("user_prompts")
      .select("format, prompt")
      .eq("user_id", userId);

    if (error) {
      if (isPromptsTableUnavailable(error)) return {};
      throw error;
    }

    const map: UserPromptMap = {};
    for (const row of data ?? []) {
      if ((PROMPT_KEYS as readonly string[]).includes(row.format)) {
        map[row.format as PromptKey] = row.prompt;
      }
    }
    return map;
  } catch (err) {
    if (isPromptsTableUnavailable(err)) return {};
    throw err;
  }
}