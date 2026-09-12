// Orphan-only storage retention for the private `sources` bucket, run by the
// Vercel Cron route `/api/cron/storage-retention`.
//
// Deliberately conservative v1 policy: delete ONLY objects that are provably
// orphaned —
//   (a) everything under a user prefix whose `auth.users` row no longer exists
//       (account deletion never touches storage), and
//   (b) objects under a live user's prefix with no matching
//       `sources.storage_path` row AND older than the grace window
//       (upload-then-insert failure orphans).
// Live source rows — `failed` / `uploaded` / `done` — are never touched;
// age-based deletion of live sources is a separate product decision.
//
// Bounded per run (maxUsers 200, maxDeletes 500) so a single Vercel invocation
// stays well under the execution limit. Per-user failures are collected into
// `errors[]` and the sweep continues; global setup failures (auth/db/storage
// reads) throw so the route can fail closed with a 500 — the sweep must never
// run against an incomplete view of what is live.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export interface SweepOptions {
  /** Objects younger than this are kept for live users. Default 24h. */
  graceMs?: number;
  /** At most this many top-level user prefixes are examined. Default 200. */
  maxUsers?: number;
  /** Hard cap on object removals per run. Default 500. */
  maxDeletes?: number;
}

export interface SweepSummary {
  /** Number of top-level user prefixes examined. */
  usersExamined: number;
  /** Object paths removed (missing-object removals count as success). */
  objectsDeleted: number;
  /** Per-prefix/per-chunk failures — never fatal, the sweep continues. */
  errors: string[];
}

const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_MAX_USERS = 200;
const DEFAULT_MAX_DELETES = 500;
const PAGE_SIZE = 1000; // list() pagination window
const REMOVE_CHUNK_SIZE = 100; // remove() chunk cap

type StorageBucket = ReturnType<SupabaseClient<Database>["storage"]["from"]>;

interface ListedFile {
  /** Object path relative to the prefix the sweep started from. */
  path: string;
  createdAt: string | null;
}

export async function runStorageRetentionSweep(
  ctx: { service: SupabaseClient<Database> },
  opts: SweepOptions = {}
): Promise<SweepSummary> {
  const graceMs = opts.graceMs ?? DEFAULT_GRACE_MS;
  const maxUsers = opts.maxUsers ?? DEFAULT_MAX_USERS;
  const maxDeletes = opts.maxDeletes ?? DEFAULT_MAX_DELETES;

  const summary: SweepSummary = { usersExamined: 0, objectsDeleted: 0, errors: [] };

  // 1 + 2. Live reality before any delete: all auth user ids and all known
  // storage paths. Fail closed — if either read fails, delete NOTHING.
  const authUserIds = await collectAuthUserIds(ctx.service);
  const knownPaths = await collectKnownPaths(ctx.service);

  const bucket = ctx.service.storage.from("sources");

  // 3. Walk the bucket root page by page; every folder entry = one user prefix.
  let offset = 0;
  rootLoop: for (;;) {
    const { data, error } = await bucket.list("", { limit: PAGE_SIZE, offset });
    if (error) {
      throw new Error(`Failed to list storage root: ${error.message}`);
    }
    const entries = data ?? [];
    for (const entry of entries) {
      if (entry.metadata !== null) continue; // top-level objects are not user prefixes
      if (summary.usersExamined >= maxUsers || summary.objectsDeleted >= maxDeletes) {
        break rootLoop;
      }

      summary.usersExamined += 1;
      if (authUserIds.has(entry.name)) {
        // 4b. Live user: delete only aged objects with no sources row.
        await purgeLiveUserOrphans(bucket, entry.name, knownPaths, graceMs, summary, maxDeletes);
      } else {
        // 4a. Deleted user: delete everything under the prefix, regardless of age.
        await purgeDeletedUserPrefix(bucket, entry.name, summary, maxDeletes);
      }
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return summary;
}

/** All auth user ids, paginated — service client only. */
async function collectAuthUserIds(service: SupabaseClient<Database>): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.id) ids.add(user.id);
    }
    if (data?.nextPage == null || users.length === 0) break;
    page = data.nextPage;
  }
  return ids;
}

/** Every non-null `sources.storage_path` — the live-file allowlist. */
async function collectKnownPaths(service: SupabaseClient<Database>): Promise<Set<string>> {
  const paths = new Set<string>();
  const { data, error } = await service.from("sources").select("storage_path");
  if (error) {
    throw new Error(`Failed to read sources.storage_path: ${error.message}`);
  }
  for (const row of data ?? []) {
    if (row.storage_path) paths.add(row.storage_path);
  }
  return paths;
}

/** Deleted-user prefix: collect every object (recursively), delete all of it. */
async function purgeDeletedUserPrefix(
  bucket: StorageBucket,
  userId: string,
  summary: SweepSummary,
  maxDeletes: number
): Promise<void> {
  try {
    // Every object under a deleted user's prefix is an orphan — collecting more
    // than the remaining budget would be wasted listing.
    const files = await collectFilesRecursive(bucket, userId, maxDeletes - summary.objectsDeleted);
    const paths = files.map((f) => `${userId}/${f.path}`);
    await removePaths(bucket, paths, summary, maxDeletes);
  } catch (err) {
    summary.errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Live-user prefix: delete objects with no sources row and older than grace. */
async function purgeLiveUserOrphans(
  bucket: StorageBucket,
  userId: string,
  knownPaths: Set<string>,
  graceMs: number,
  summary: SweepSummary,
  maxDeletes: number
): Promise<void> {
  try {
    const oldestAllowed = Date.now() - graceMs;
    const candidates: string[] = [];
    const files = await collectFilesRecursive(bucket, userId);
    for (const file of files) {
      if (summary.objectsDeleted >= maxDeletes) break;
      const full = `${userId}/${file.path}`;
      if (knownPaths.has(full)) continue; // a live source row owns this object — never delete
      const created = file.createdAt ? Date.parse(file.createdAt) : NaN;
      // Unknown/parseable? keep. Too new? keep (grace window).
      if (Number.isNaN(created) || created >= oldestAllowed) continue;
      candidates.push(full);
    }
    await removePaths(bucket, candidates, summary, maxDeletes);
  } catch (err) {
    summary.errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Recursively list every file under `prefix` (descending into folder entries),
 * paginating each level. `cap` bounds the result so a deleted-user purge stops
 * listing once it has found enough objects — `cap` is a soft stop, never a
 * delete limit.
 */
async function collectFilesRecursive(
  bucket: StorageBucket,
  prefix: string,
  cap?: number,
  subPath = ""
): Promise<ListedFile[]> {
  const out: ListedFile[] = [];
  if (cap !== undefined && cap <= 0) return out;

  let offset = 0;
  for (;;) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE_SIZE, offset });
    if (error) {
      throw new Error(`Failed to list storage prefix ${prefix}: ${error.message}`);
    }
    const entries = data ?? [];
    for (const entry of entries) {
      if (cap !== undefined && out.length >= cap) return out;
      const rel = subPath ? `${subPath}/${entry.name}` : entry.name;
      if (entry.metadata === null) {
        out.push(...(await collectFilesRecursive(bucket, `${prefix}/${entry.name}`, cap === undefined ? undefined : cap - out.length, rel)));
      } else {
        out.push({ path: rel, createdAt: entry.created_at });
      }
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

/**
 * Remove paths in chunks of ≤100, honoring the maxDeletes budget. Returns true
 * when the budget is exhausted and the sweep should stop.
 */
async function removePaths(
  bucket: StorageBucket,
  paths: string[],
  summary: SweepSummary,
  maxDeletes: number
): Promise<boolean> {
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK_SIZE) {
    if (summary.objectsDeleted >= maxDeletes) return true;
    const chunk = paths.slice(i, i + REMOVE_CHUNK_SIZE);
    const remaining = maxDeletes - summary.objectsDeleted;
    const toRemove = chunk.length <= remaining ? chunk : chunk.slice(0, remaining);
    try {
      const { error } = await bucket.remove(toRemove);
      if (error && !isMissingObjectError(error)) {
        summary.errors.push(`${toRemove[0]}: ${error.message}`);
        continue;
      }
      // Success, and an already-missing object is success too: the path is
      // gone (e.g. marker paths like {userId}/buffer-post/{postId} that have
      // no object). Count both — the outcome for that path is the same.
      summary.objectsDeleted += toRemove.length;
    } catch (err) {
      // A thrown low-level failure must never abort the sweep.
      summary.errors.push(`${toRemove[0]}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (summary.objectsDeleted >= maxDeletes) return true;
  }
  return false;
}

function isMissingObjectError(error: { message?: string; status?: number; statusCode?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.status === 404 ||
    error.statusCode === "404" ||
    message.includes("not found") ||
    message.includes("no such object") ||
    message.includes("does not exist")
  );
}