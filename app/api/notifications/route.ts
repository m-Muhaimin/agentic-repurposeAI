import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notificationRowToRecord } from "@/lib/notifications";
import { log } from "@/lib/logger";

// Matches PostgREST/Supabase errors that mean the notifications table hasn't
// been created yet (migration 20260912000001 not run). Same grammar as
// lib/prompts.ts::isPromptsTableUnavailable — a missing table degrades to an
// empty list instead of breaking the notifications UI.
const MISSING_TABLE_PATTERN =
  /could not find the\s*\w*\s*["']?\w+|does\s*not\s*exist|PGRST205|42P01/i;

function isTableMissing(err: unknown): boolean {
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    return MISSING_TABLE_PATTERN.test(typeof message === "string" ? message : String(err));
  }
  return err != null && MISSING_TABLE_PATTERN.test(String(err));
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const CURSOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strict ISO-8601 with capture groups for every component (groups 1-6: year →
// second; 7: optional fraction; 8: zone offset). Kept strict so garbage shapes
// never reach PostgREST.
const CURSOR_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// True when createdAt is a strict-ISO timestamp Postgres will accept.
// `Date.parse` alone is insufficient: V8 NORMALIZES calendar-invalid literals
// that still match the regex (2026-02-30T00:00:00Z parses to Mar 2, non-NaN),
// and PostgREST then rejects the literal → a logged 500 on garbage input. So
// after the parse we reconstruct the UTC wall-clock from the parsed Date and
// compare every component against the regex-captured digits; ANY mismatch (Feb
// 30 / month 13 / day 31 rollovers, an offset that shifts the wall clock,
// offsets beyond ±14:00) means the literal never round-trips and the cursor is
// treated as absent ("garbage → newest page").
function isValidCursorCreatedAt(createdAt: string): boolean {
  const match = CURSOR_ISO_RE.exec(createdAt);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, fraction] = match;
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) return false;
  const date = new Date(parsed);
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second) &&
    // Milliseconds only when the fraction group is present (optional per ISO).
    (fraction === undefined ||
      date.getUTCMilliseconds() === Number(fraction.slice(1).padEnd(3, "0").slice(0, 3)))
  );
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(request.url);

  const rawLimit = Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)))
    : DEFAULT_LIMIT;

  // Opaque keyset cursor: `${encodeURIComponent(createdAt)}|${id}`. Garbage
  // (wrong shape, calendar-invalid timestamp, or unparseable literal) is
  // treated as "no cursor" — the client just gets the newest page again
  // instead of a 400 (or a 500 from Postgres rejecting the literal).
  //
  // Both halves are interpolated verbatim into the PostgREST `or()` filter, so
  // they are strictly validated before use: a crafted id like
  // `X),status.eq.failed` would otherwise alter the filter set (self-inflicted
  // 500 / distorted pagination). Invalid cursors keep the no-cursor behavior.
  const cursorRaw = url.searchParams.get("cursor");
  let cursor: { createdAt: string; id: string } | null = null;
  if (cursorRaw) {
    const parts = cursorRaw.split("|");
    if (parts.length === 2) {
      try {
        const createdAt = decodeURIComponent(parts[0]);
        const id = parts[1];
        if (createdAt && id && isValidCursorCreatedAt(createdAt) && CURSOR_UUID_RE.test(id)) {
          cursor = { createdAt, id };
        }
      } catch {
        // Malformed percent-encoding — start from the top.
      }
    }
  }

  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const type = url.searchParams.get("type")?.trim() || null;

  // user_id comes from the session ONLY — never from query params.
  let query = supabase.from("notifications").select("*").eq("user_id", user.id);

  if (cursor) {
    // Keyset on (created_at, id): strictly older rows than the cursor. Same
    // `or()` grammar as the job-claim filter in app/api/process/route.ts
    // (`status.eq.queued,and(status.eq.running,started_at.lt.X)`).
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }
  if (unreadOnly) query = query.is("read_at", null);
  if (type) query = query.eq("type", type);

  // Fetch limit + 1: the extra row proves a next page exists (and is dropped).
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error) {
    if (isTableMissing(error)) {
      log.warn("notifications.table_missing");
      return NextResponse.json({ notifications: [], nextCursor: null, unreadCount: 0 });
    }
    log.error("notifications.list_failed", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? `${encodeURIComponent(last.created_at)}|${last.id}` : null;

  // Unread count — backed by the partial index on (user_id) where read_at is null.
  const { count, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (countError) {
    if (isTableMissing(countError)) {
      log.warn("notifications.table_missing");
      return NextResponse.json({ notifications: [], nextCursor: null, unreadCount: 0 });
    }
    log.error("notifications.count_failed", countError);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }

  return NextResponse.json({
    notifications: page.map(notificationRowToRecord),
    nextCursor,
    unreadCount: count ?? 0
  });
}