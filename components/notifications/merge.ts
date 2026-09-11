// Pure id-based merge for notification lists. Incoming rows replace existing
// rows with the same id (a re-sent row after mark-read must reconcile its
// readAt), and new ids land in newest-first order. The API returns pages in
// (created_at, id) desc order and Realtime INSERTs arrive one row at a time,
// so a Map + sort keeps display order deterministic regardless of merge
// direction — overlapping realtime + poll + load-more responses can never
// duplicate an id.

export function mergeNotificationsById<T extends { id: string; createdAt: string }>(
  existing: readonly T[],
  incoming: readonly T[]
): T[] {
  const byId = new Map<string, T>();
  for (const n of existing) byId.set(n.id, n);
  for (const n of incoming) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    // createdAt ties break on id desc, mirroring the DB keyset (created_at, id).
    return a.id < b.id ? 1 : -1;
  });
}