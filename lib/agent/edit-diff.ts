// Pure helpers for computing the diff shape between an original draft and the
// user's edited version. Used by the edit-signal capture path so the signal's
// `whatChanged` field is deterministic, typed, and bounded.

export type EditSeverity = "unchanged" | "light_polish" | "moderate_edit" | "heavy_rewrite";

export interface EditDiffSummary {
  tokensAdded: number;
  tokensRemoved: number;
  tokenDelta: number;
  severity: EditSeverity;
  description: string;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export function computeEditDiff(original: string, edited: string): EditDiffSummary {
  if (original === edited) {
    return { tokensAdded: 0, tokensRemoved: 0, tokenDelta: 0, severity: "unchanged", description: "no change" };
  }

  const origTokens = tokenize(original);
  const newTokens = tokenize(edited);

  const origSet = new Map<string, number>();
  for (const t of origTokens) origSet.set(t, (origSet.get(t) ?? 0) + 1);

  const newSet = new Map<string, number>();
  for (const t of newTokens) newSet.set(t, (newSet.get(t) ?? 0) + 1);

  let tokensRemoved = 0;
  for (const [token, count] of origSet) {
    const newCount = newSet.get(token) ?? 0;
    tokensRemoved += Math.max(0, count - newCount);
  }

  let tokensAdded = 0;
  for (const [token, count] of newSet) {
    const origCount = origSet.get(token) ?? 0;
    tokensAdded += Math.max(0, count - origCount);
  }

  const tokenDelta = tokensAdded - tokensRemoved;
  const baseTokens = Math.max(origTokens.length, 1);
  const changeRatio = (tokensAdded + tokensRemoved) / baseTokens;

  let severity: EditSeverity;
  if (changeRatio < 0.2) severity = "light_polish";
  else if (changeRatio < 0.4) severity = "moderate_edit";
  else severity = "heavy_rewrite";

  const parts: string[] = [];
  if (tokensAdded > 0) parts.push(`+${tokensAdded} tokens`);
  if (tokensRemoved > 0) parts.push(`-${tokensRemoved} tokens`);
  if (tokenDelta !== 0) parts.push(`net ${tokenDelta > 0 ? "+" : ""}${tokenDelta}`);

  return {
    tokensAdded,
    tokensRemoved,
    tokenDelta,
    severity,
    description: parts.length ? parts.join(", ") : "reformatted"
  };
}
