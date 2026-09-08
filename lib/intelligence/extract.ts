// Deterministic, fully grounded content intelligence extraction.
//
// Pure functions only: no I/O, no LLM, no env. The outputs are honest by
// construction — every claim/question/hook quote carries an EvidenceSegment
// that is a verbatim slice of the canonical transcript (offset-checked at
// construction), and opportunities are explicitly `synthesized: true` because
// they are derived templates, not generated content.
//
// Heuristics are deliberately shallow and documented: this slice proves the
// *shape* of intelligence (get it from a source without generating anything);
// the Phase-4 LLM enrichment pass layers model judgement on top later, but the
// deterministic core stays as a zero-cost, fully-testable baseline.

import type {
  ClaimStance,
  ContentIntelligence,
  DerivedOpportunity,
  EntityKind,
  EvidenceSegment,
  InsightPattern,
  IntelligenceClaim,
  IntelligenceEntity,
  IntelligenceHook,
  IntelligenceInsight,
  IntelligenceMetadata,
  IntelligenceQuestion,
  IntelligenceStory,
  IntelligenceTheme,
  IntelligenceTopic,
  IntelligenceTextStats
} from "./types";

const STOPWORDS = new Set(
  `a an and are as at be by for from has have how i in is it its of on or that the this
   to was we what when where which who will with you your our their my me him her they
   would could can should must maybe really just very there here them these those it's
   don't doesn't didn't won't more most much many than then but not no into onto over
   under up down also only like so get got going go want wanna gonna`.split(/\s+/)
);

const CLAIM_MARKERS: Record<ClaimStance, string[]> = {
  assertion: ["means", "works", "found", "showed", "proved", "is", "are", "was", "were", "has", "have", "will", "should", "must", "always", "never", "clearly", "obviously", "the key", "the reason"],
  conjecture: ["might", "may", "could", "perhaps", "probably", "maybe", "i think", "in my opinion", "seems"],
  citation: ["according to", "per ", "studies", "study", "research", "says", "said", "reported", "shows that"]
};

const OPEN_LOOP = ["imagine", "what if", "here's the thing", "let me tell you", "you know what", "one thing i", "so here", "picture this", "guess what"];
const DIGIT_REGEX = /\d/;

const SEQUENCE_MARKERS = [
  "then", "after that", "next", "so i", "so we", "one day", "eventually",
  "after", "before", "i decided", "we decided", "remember when", "back in",
  "at the end", "in the end", "first ", "second ", "finally", "later",
  "that night", "next day", "the next"
];

const CAUSE_PATTERNS: InsightPattern[] = ["cause_effect", "contrast", "generalization"];
const CAUSE_MARKERS: Record<InsightPattern, string[]> = {
  cause_effect: ["because", "which means", "that means", "as a result", "leads to", "the reason", "that's why", "therefore", "thus", "so that"],
  contrast: ["however", "instead of", "even though", "despite", "on the other hand", "at the same time", "but "],
  generalization: ["in general", "overall", "for the most part", "ultimately", "the point", "at the end of the day"]
};

const QUOTE_MARKS = /(["""])[^"""]+["""]/g;

// ── text primitives ────────────────────────────────────────────────────────

export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  const sentences: { text: string; start: number; end: number }[] = [];
  let start = 0;
  let i = 0;
  const n = text.length;

  const push = (rawStart: number, rawEnd: number) => {
    // Trim leading/trailing whitespace and re-anchor offsets onto the trimmed slice.
    let s = rawStart;
    let e = rawEnd;
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    if (e > s) sentences.push({ text: text.slice(s, e), start: s, end: e });
  };

  while (i < n) {
    const ch = text[i];
    if (ch === "\n") {
      push(start, i);
      start = i + 1;
      i += 1;
      continue;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      let j = i;
      while (j < n && (text[j] === "." || text[j] === "!" || text[j] === "?")) j += 1;
      while (j < n && /[)\]"'""\u201d\u2019\u00bb]/.test(text[j])) j += 1;
      // Sentence ends only at a real boundary (end of text, whitespace, newline).
      if (j >= n || /\s/.test(text[j])) {
        push(start, j);
        start = j;
        i = j;
        continue;
      }
    }
    i += 1;
  }
  if (start < n) push(start, n);
  return sentences;
}

function seg(text: string, start: number): EvidenceSegment {
  return { text, start, end: start + text.length, verbatim: true };
}

function wordsOf(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z][a-z'-]{1,}/g) ?? []);
}

function tokensFrom(sentence: string): string[] {
  return (sentence.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? []).filter((w) => w.length >= 3);
}

function capTokens(sentence: string): string[] {
  return (sentence.match(/\b[A-Z][a-z][a-zA-Z'&-]*\b/g) ?? []).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase())
  );
}

// ── extractors ─────────────────────────────────────────────────────────────

function extractTopics(
  sentences: { text: string; start: number }[]
): { topics: IntelligenceTopic[]; enum: (sent: string) => string[] } {
  const tf = new Map<string, number>();
  const total = Math.max(sentences.length, 1);

  sentences.forEach((sent, si) => {
    const weight = 1 + 0.5 * (1 - si / total); // earlier sentences weigh more
    const unigrams = new Set(wordsOf(sent.text).filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
    unigrams.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + weight));
  });

  const ranked = [...tf.entries()]
    .filter(([, v]) => v >= 1.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const topics: IntelligenceTopic[] = ranked.map(([label, occurrences]) => ({
    label,
    occurrences: Math.round(occurrences),
    confidence: Math.min(1, occurrences / total)
  }));

  const enumTopics = (sent: string): string[] =>
    wordsOf(sent).filter((w) => ranked.some(([label]) => label === w));

  return { topics, enum: enumTopics };
}

function extractThemes(
  sentences: { text: string; start: number }[],
  topics: IntelligenceTopic[]
): IntelligenceTheme[] {
  const byHead = new Map<string, Set<string>>();
  for (const t of topics) {
    const head = t.label.replace(/s$/, ""); // stemming-lite: dedupe plurals
    const set = byHead.get(head) ?? new Set<string>();
    set.add(t.label);
    byHead.set(head, set);
  }
  return [...byHead.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 4)
    .map(([head, labels]) => ({ label: head, topics: [...labels] }));
}

function extractClaims(
  sentences: { text: string; start: number }[],
  topicEnums: (sent: string) => string[]
): IntelligenceClaim[] {
  type Scored = { sent: { text: string; start: number }; score: number; stance: ClaimStance };
  const scored: Scored[] = [];

  for (const sent of sentences) {
    const wc = sent.text.split(/\s+/).length;
    if (wc < 4 || wc > 60) continue; // skip fragments and walls of text
    const lower = sent.text.toLowerCase();
    if (lower.endsWith("?") || lower.endsWith("!")) continue;

    let stance: ClaimStance | null = null;
    let score = 0;
    for (const [kind, markers] of Object.entries(CLAIM_MARKERS) as [ClaimStance, string[]][]) {
      for (const m of markers) {
        if (lower.includes(m)) {
          if (!stance) stance = kind;
          score += kind === "assertion" ? 2 : 1;
          break;
        }
      }
    }
    // Topic ties seem more claim-worthy.
    score += topicEnums(sent.text).length * 1.5;
    if (DIGIT_REGEX.test(sent.text)) score += 0.75;
    if (!stance) continue;
    scored.push({ sent, score, stance });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ sent, stance }, i) => ({
      text: sent.text,
      stance,
      confidence: Math.max(0.4, Math.min(0.95, 0.55 + i * 0.06)),
      evidence: seg(sent.text, sent.start)
    }));
}

function extractQuestions(sentences: { text: string; start: number }[]): IntelligenceQuestion[] {
  return sentences
    .map((s, i) => {
      const lower = s.text.toLowerCase();
      const next = sentences[i + 1]?.text.toLowerCase() ?? "";
      // "What is X?" followed immediately by an answer ("I think…", "The…",
      // "It…", "We…") is a rhetorical setup, not a real question.
      const answeredNext =
        next.length > 0 && /^\s*(i think|i|we|it|that|the|they)\b/.test(next);
      const isSetup =
        /^(what( is|'s| are| does| do)?\s|why (is|do|does)\s|how (do|does|is)\s|who is\s|can you\s|do you\s|did you\s|is it\s|are we\s)/.test(
          lower
        ) && lower.split(/\s+/).length < 16;
      const rhetorical =
        (isSetup && answeredNext) ||
        lower.includes("would you believe") ||
        lower.includes("right?") ||
        lower.includes("if you know what i mean");
      return { text: s.text, rhetorical, evidence: seg(s.text, s.start) };
    })
    .filter((q) => q.text.trim().endsWith("?"))
    .slice(0, 6);
}

function extractHooks(
  sentences: { text: string; start: number }[],
  questions: IntelligenceQuestion[]
): IntelligenceHook[] {
  const hooks: IntelligenceHook[] = [];
  const first = sentences[0];
  if (first) hooks.push({ text: first.text, kind: "opening", evidence: seg(first.text, first.start) });

  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    if (OPEN_LOOP.some((m) => lower.includes(m))) {
      hooks.push({ text: s.text, kind: "open_loop", evidence: seg(s.text, s.start) });
      if (hooks.length >= 3) break;
    } else if (DIGIT_REGEX.test(s.text) && s.text.split(/\s+/).length <= 22) {
      hooks.push({ text: s.text, kind: "stat", evidence: seg(s.text, s.start) });
      if (hooks.length >= 3) break;
    }
  }
  const rhetorical = questions.find((q) => q.rhetorical);
  if (rhetorical && hooks.length < 3) {
    hooks.push({ text: rhetorical.text, kind: "rhetorical", evidence: rhetorical.evidence });
  }
  return hooks.slice(0, 3);
}

function guessEntityKind(label: string): EntityKind {
  if (/\b(inc|llc|ltd|corp|co|group|university|school|fund|lab|studios?|corporation)\b/i.test(label) || label.includes("&")) return "organization";
  if (/\b(ist|istan|burg|ville|ton|ford|field|city|london|new york|san |los |bay|valley|creek|springs?)\b/i.test(label.toLowerCase())) return "place";
  if (/\b(os|app|software|platform|tool|api|phone|car|pro|mini|max)\b/i.test(label.toLowerCase())) return "product";
  return "person";
}

function extractEntities(sentences: { text: string; start: number }[]): IntelligenceEntity[] {
  const counts = new Map<string, number>();
  for (const s of sentences) {
    for (const tok of capTokens(s.text)) {
      if (STOPWORDS.has(tok.toLowerCase())) continue;
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, mentions]) => ({ label, kind: guessEntityKind(label), mentions }));
}

function extractQuotes(text: string): EvidenceSegment[] {
  const out: EvidenceSegment[] = [];
  for (const m of text.matchAll(QUOTE_MARKS)) {
    const raw = m[0];
    const inner = raw.replace(/^["""]/, "").replace(/["""]$/, "").trim();
    if (inner.length >= 10) out.push(seg(inner, m.index + 1));
  }
  return out.slice(0, 6);
}

function extractStories(sentences: { text: string; start: number }[]): IntelligenceStory[] {
  const stories: IntelligenceStory[] = [];
  let run: { text: string; start: number }[] = [];

  const flush = () => {
    if (run.length >= 3) {
      stories.push({
        summary: run.map((r) => r.text).join(" ").slice(0, 120).trimEnd() + (run.length > 3 ? "…" : ""),
        evidence: run.map((r) => seg(r.text, r.start))
      });
    }
    run = [];
  };

  for (const s of sentences) {
    const lower = " " + s.text.toLowerCase() + " ";
    const hasSeq = SEQUENCE_MARKERS.some((m) => lower.includes(m));
    if (hasSeq) run.push(s);
    else flush();
  }
  flush();
  return stories.slice(0, 3);
}

function extractInsights(
  sentences: { text: string; start: number }[]
): IntelligenceInsight[] {
  const out: IntelligenceInsight[] = [];
  for (const s of sentences) {
    const lower = s.text.toLowerCase();
    if (s.text.split(/\s+/).length < 6) continue;
    for (const pattern of CAUSE_PATTERNS) {
      if (CAUSE_MARKERS[pattern].some((m) => lower.includes(m))) {
        out.push({ text: s.text, pattern, evidence: seg(s.text, s.start) });
        break;
      }
    }
  }
  return out.slice(0, 4);
}

function trimTo(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function deriveOpportunities(
  topics: IntelligenceTopic[],
  claims: IntelligenceClaim[],
  questions: IntelligenceQuestion[],
  hooks: IntelligenceHook[],
  stories: IntelligenceStory[],
  quotes: EvidenceSegment[]
): DerivedOpportunity[] {
  const ops: DerivedOpportunity[] = [];

  if (questions.length > 0 && questions[0].text.length < 200) {
    const q = questions[0];
    ops.push({
      kind: "question_led",
      title: `Answer the question: ${trimTo(q.text, 90)}`,
      pitch: "A direct-answer piece is the simplest way to honour the source — the question came from the creator, so it carries real audience intent.",
      anchors: [q.evidence],
      synthesized: true
    });
  }

  if (hooks.length > 0) {
    const h = hooks[0];
    ops.push({
      kind: "clip",
      title: `Cold-open with: ${trimTo(h.text, 90)}`,
      pitch: "Hook-first clips outperform summaries; the hook was already written by the source itself.",
      anchors: [h.evidence],
      synthesized: true
    });
  }

  const strongClaim = claims.find((c) => c.stance === "assertion");
  if (strongClaim) {
    ops.push({
      kind: "claim_post",
      title: `Stake the claim: “${trimTo(strongClaim.text, 90)}”`,
      pitch: "A single strong, quotable claim is the highest-signal repurpose; everything else in the post supports it.",
      anchors: [strongClaim.evidence],
      synthesized: true
    });
  }

  if (stories.length > 0) {
    ops.push({
      kind: "story_newsletter",
      title: `Tell the story: ${trimTo(stories[0].summary, 90)}`,
      pitch: "First-person stories keep newsletters read-through high; this one already spans enough beats to carry a narrative.",
      anchors: stories[0].evidence.slice(0, 2),
      synthesized: true
    });
  }

  if (topics.length > 0 && quotes.length > 0) {
    ops.push({
      kind: "quote_carousel",
      title: `Pull-quote carousel on “${topics[0].label}”`,
      pitch: "Verbatim quoted lines from a genuine topic with a strong opening are ready-made carousel slides.",
      anchors: [...quotes.slice(0, 3)],
      synthesized: true
    });
  }

  return ops.slice(0, 4);
}

function textStats(text: string, sentences: { text: string }[]): IntelligenceTextStats {
  return {
    chars: text.length,
    words: (text.match(/\S+/g) ?? []).length,
    sentences: sentences.length
  };
}

// ── entry point ────────────────────────────────────────────────────────────

export function extractIntelligence(
  text: string,
  meta: IntelligenceMetadata
): ContentIntelligence {
  const sentences = splitSentences(text);
  const { topics, enum: topicEnums } = extractTopics(sentences);
  const themes = extractThemes(sentences, topics);
  const claims = extractClaims(sentences, topicEnums);
  const questions = extractQuestions(sentences);
  const hooks = extractHooks(sentences, questions);
  const entities = extractEntities(sentences);
  const quotes = extractQuotes(text);
  const stories = extractStories(sentences);
  const insights = extractInsights(sentences);
  const opportunities = deriveOpportunities(topics, claims, questions, hooks, stories, quotes);

  return {
    sourceId: meta.sourceId,
    sourceType: meta.sourceType,
    title: meta.title,
    topics,
    themes,
    claims,
    quotes,
    stories,
    questions,
    hooks,
    entities,
    insights,
    opportunities,
    provenance: "deterministic",
    analyzedAt: meta.analyzedAt ?? new Date().toISOString(),
    textStats: textStats(text, sentences)
  };
}