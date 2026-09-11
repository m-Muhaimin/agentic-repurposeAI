// SERVER-ONLY — never import this module (or the barrel) from a client component
// createNotification — the ONLY writer to the `notifications` table (Phase 3).
// Mirrors lib/analytics/events.ts::track: service-role, best-effort, NEVER
// throws into the product path. A failed notification is a logged warning, not
// a 500 on the user's job (docs/NOTIFICATION_ARCHITECTURE.md §2, §10).
//
// Pipeline per the locked contract: validate (reject → log + null) → sanitize
// (trim/strip/truncate) → dedupe-aware insert via the service client → map the
// snake_case row to the camelCase NotificationRecord.

import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { Database } from "@/types/supabase";
import {
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_TYPES,
  isSafeActionUrl,
  type NotificationInput,
  type NotificationRecord,
  type NotificationSeverity
} from "./types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// ── Row → domain record ──────────────────────────────────────────────────────

export function notificationRowToRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationRecord["type"],
    title: row.title,
    body: row.body,
    severity: row.severity,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actionUrl: row.action_url,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    dedupeKey: row.dedupe_key,
    expiresAt: row.expires_at,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

// ── Sanitize helpers ─────────────────────────────────────────────────────────

const CONTROL_CHARS = /[\u0000-\u001f\u007f\u0080-\u009f]/g;
// Same, but \n (0x0a) survives — body text may be multi-line.
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f\u0080-\u009f]/g;

function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}

function stripControlCharsKeepNewline(s: string): string {
  return s.replace(CONTROL_CHARS_KEEP_NEWLINE, "");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

// Trim + null-if-empty for the free-form entity fields (hygiene, not safety:
// they are never rendered as links).
function normalizeNullable(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? truncate(trimmed, max) : null;
}

// true when the value survives JSON.stringify losslessly (no functions,
// undefined/symbol/bigint, no NaN) and with no cycles. Callers must run
// JSON.stringify FIRST (it throws on cycles); this walk then catches the
// values stringify silently drops or mangles.
function isMetadataJsonSafe(value: unknown): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") return false;
  if (t === "number" && !Number.isFinite(value)) return false;
  if (t === "object") {
    if (Array.isArray(value)) return value.every(isMetadataJsonSafe);
    return Object.values(value as Record<string, unknown>).every(isMetadataJsonSafe);
  }
  return true;
}

// ── createNotification ───────────────────────────────────────────────────────

export async function createNotification(input: NotificationInput): Promise<NotificationRecord | null> {
  try {
    // 1. VALIDATE — fail fast, log a drop, never throw.
    const userId = input.userId?.trim() ?? "";
    if (!userId) return reject("user_id_empty", input.type);
    if (!NOTIFICATION_TYPES.includes(input.type)) return reject("invalid_type", input.type);

    const severity: NotificationSeverity = input.severity ?? "info";
    if (!NOTIFICATION_SEVERITIES.includes(severity)) return reject("invalid_severity", input.type);

    if (typeof input.title !== "string" || typeof input.body !== "string") {
      return reject("title_or_body_not_string", input.type);
    }
    if (!input.title.trim() || !input.body.trim()) return reject("title_or_body_empty", input.type);

    if (input.actionUrl != null && !isSafeActionUrl(input.actionUrl)) {
      return reject("unsafe_action_url", input.type);
    }

    if (input.dedupeKey != null && input.dedupeKey.length > 255) return reject("dedupe_key_too_long", input.type);

    let metadata: Record<string, unknown> | null = null;
    if (input.metadata != null) {
      // Cycles first: JSON.stringify throws on them, which is also the safe
      // detector (the deep walk below would recurse forever on a cycle).
      try {
        JSON.stringify(input.metadata);
      } catch {
        return reject("metadata_invalid", input.type);
      }
      // Then the values stringify would silently DROP (functions, undefined) —
      // those are rejections too, because they break round-tripping.
      if (!isMetadataJsonSafe(input.metadata)) return reject("metadata_invalid", input.type);
      const bytes = Buffer.byteLength(JSON.stringify(input.metadata), "utf8");
      if (bytes > 2048) return reject("metadata_too_large", input.type);
      metadata = input.metadata;
    }

    // 2. SANITIZE — long-but-legal text is truncated silently; only
    // empty-after-trim is rejected (above).
    const title = truncate(stripControlChars(input.title.trim()), 160);
    const body = truncate(stripControlCharsKeepNewline(input.body.trim()), 1000);
    const entityType = normalizeNullable(input.entityType, 255);
    const entityId = normalizeNullable(input.entityId, 128);
    const dedupeKey = input.dedupeKey?.trim() || null;

    const payload: Database["public"]["Tables"]["notifications"]["Insert"] = {
      user_id: userId,
      type: input.type,
      title,
      body,
      severity,
      entity_type: entityType,
      entity_id: entityId,
      action_url: input.actionUrl ?? null,
      metadata,
      dedupe_key: dedupeKey,
      expires_at: input.expiresAt ?? null
      // read_at / created_at are deliberately never supplied: read state belongs
      // to the RPCs, created_at to the DB default.
    };

    const db = createServiceClient();

    // 3. DEDUPE — opt-in per notification: a unique dedupe_key means "this
    // transition may be re-emitted after transient failures, but only the first
    // row counts". Backed by the per-user unique constraint (user_id,
    // dedupe_key) (migration 20260912000001) — dedupe scope is per-tenant.
    //
    // NOTE: the installed @supabase/postgrest-js (2.115.0) dropped the old
    // chainable `.insert().onConflict().ignoreDuplicates()` API; `.upsert()`
    // with `{ onConflict, ignoreDuplicates }` emits the identical wire request
    // (`on_conflict=user_id,dedupe_key` + `Prefer: resolution=ignore-duplicates` +
    // `return=representation` via .select()), so the conflict semantics are
    // unchanged: a dedupe hit returns zero rows and `.single()` surfaces it as
    // error code PGRST116 — that is the dedupe-hit signal below. The composite
    // target must name BOTH columns: Postgres `ON CONFLICT` only accepts a
    // conflict target that exactly matches a unique constraint.
    if (dedupeKey) {
      const { data, error } = await db
        .from("notifications")
        .upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select()
        .single();

      if (error && error.code === "PGRST116") {
        // Dedupe hit: the unique key swallowed our insert. Re-read the existing
        // row so callers still get a usable NotificationRecord. The re-select
        // is scoped to THIS user via user_id too — the service client bypasses
        // RLS, so without the filter a future key-composition change could
        // resolve a row belonging to another tenant.
        log.info("notification.dedupe", { dedupeKey });
        const { data: existing, error: lookupError } = await db
          .from("notifications")
          .select("*")
          .eq("dedupe_key", dedupeKey)
          .eq("user_id", userId)
          .maybeSingle();
        if (lookupError || !existing) return null;
        return notificationRowToRecord(existing);
      }

      if (error || !data) return createFailed(input.type, userId, entityType, entityId, error?.message);

      logCreated(input.type, userId, entityType, entityId);
      return notificationRowToRecord(data);
    }

    // 4. PLAIN INSERT — no dedupe key: every occurrence is a legitimate event.
    const { data, error } = await db.from("notifications").insert(payload).select().single();
    if (error || !data) return createFailed(input.type, userId, entityType, entityId, error?.message);

    logCreated(input.type, userId, entityType, entityId);
    return notificationRowToRecord(data);
  } catch (err) {
    // 5. NEVER throw — an unexpected exception is a logged warning.
    log.warn("notification.create_failed", {
      type: input?.type,
      user_id: input?.userId,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

function reject(reason: string, type: unknown): null {
  log.warn("notification.rejected", { reason, type: typeof type === "string" ? type : String(type) });
  return null;
}

function createFailed(
  type: string,
  userId: string,
  entityType: string | null,
  entityId: string | null,
  message: string | undefined
): null {
  log.warn("notification.create_failed", { type, user_id: userId, entity_type: entityType, entity_id: entityId, error: message ?? "no row returned" });
  return null;
}

function logCreated(type: string, userId: string, entityType: string | null, entityId: string | null): void {
  // Ids only — never title/body content (docs/NOTIFICATION_ARCHITECTURE.md §12).
  log.info("notification.created", { type, user_id: userId, entity_type: entityType, entity_id: entityId });
}