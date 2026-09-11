"use client";

// Client state for the notification bell AND the /notifications page — one
// implementation, two mounts (docs/NOTIFICATION_ARCHITECTURE.md §6). Owns the
// first-page fetch, cursor pagination, Realtime INSERT merging on the user's
// own filtered channel, and a light 30s + visibility polling fallback. The
// server API is the source of truth; Realtime is a delivery optimization.
//
// Import note: severity/type constants come from @/lib/notifications/types
// (dependency-free) — deliberately NOT the lib/notifications barrel, which
// re-exports create.ts and would drag the service-role client + logger into
// the client bundle.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_SEVERITIES,
  type NotificationSeverity,
  type NotificationType
} from "@/lib/notifications/types";
import { mergeNotificationsById } from "./merge";

// Minimal local mirror of the API's camelCase NotificationRecord — the wire
// contract for GET /api/notifications (lib/notifications/types.ts keeps the
// canonical shape server-side). Local so the client bundle only ever depends
// on the two pure constants/functions imported above.
export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  dedupeKey: string | null;
  expiresAt: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsState {
  notifications: NotificationRecord[];
  nextCursor: string | null;
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

interface NotificationsResponse {
  notifications?: NotificationRecord[];
  nextCursor?: string | null;
  unreadCount?: number;
  error?: string;
}

const POLL_INTERVAL_MS = 30_000;

async function apiErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    return typeof data?.error === "string" && data.error ? data.error : "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

// postgres_changes INSERT payloads arrive as snake_case rows; map to the
// camelCase record the rest of the UI consumes. Defensive against every
// field (a Realtime payload is untyped); unknown severity falls back to the
// DB default "info" rather than ever crashing a render.
function rowToRecord(row: unknown): NotificationRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;
  return {
    id,
    userId: typeof r.user_id === "string" ? r.user_id : "",
    type: typeof r.type === "string" ? (r.type as NotificationType) : "system.announcement",
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    severity: NOTIFICATION_SEVERITIES.includes(r.severity as NotificationSeverity)
      ? (r.severity as NotificationSeverity)
      : "info",
    entityType: typeof r.entity_type === "string" ? r.entity_type : null,
    entityId: typeof r.entity_id === "string" ? r.entity_id : null,
    actionUrl: typeof r.action_url === "string" ? r.action_url : null,
    metadata:
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as Record<string, unknown>)
        : null,
    dedupeKey: typeof r.dedupe_key === "string" ? r.dedupe_key : null,
    expiresAt: typeof r.expires_at === "string" ? r.expires_at : null,
    readAt: typeof r.read_at === "string" ? r.read_at : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date().toISOString()
  };
}

export function useNotifications({
  initialLimit = 20,
  unreadOnly = false
}: {
  initialLimit?: number;
  unreadOnly?: boolean;
} = {}) {
  const limit = initialLimit;
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    nextCursor: null,
    unreadCount: 0,
    loading: true,
    loadingMore: false,
    error: null
  });

  // Latest committed state for the optimistic actions, so a click always sees
  // pre-action values even across batched updates.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const setError = useCallback(
    (error: string | null) => setState((prev) => ({ ...prev, error })),
    []
  );

  // Session identity for the filtered Realtime channel + auth-gated fetches.
  // Same getSession + onAuthStateChange pattern as user-menu.tsx:36-41. Until
  // the user id is known nothing fetches and nothing subscribes — the hook
  // never crashes on a momentarily-missing session.
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setUserId(session?.user?.id ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // One fetch for every path: initial load, unread-only toggle, load-more,
  // poll, and retry. `replace` resets the list (initial/toggle/retry);
  // `quiet` is the poll/visibility safety-net (never sets loading, keeps last
  // good data silently on transient failure — repo convention); plain calls
  // are load-more, surfacing errors without disturbing the list.
  type FetchOptions = { cursor?: string | null; replace?: boolean; quiet?: boolean };
  const fetchPage = useCallback(
    async ({ cursor = null, replace = false, quiet = false }: FetchOptions = {}) => {
      if (replace) setState((prev) => ({ ...prev, loading: true, error: null }));
      else setState((prev) => ({ ...prev, loadingMore: true }));
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set("cursor", cursor);
        if (unreadOnly) params.set("unreadOnly", "true");
        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (!res.ok) throw new Error(await apiErrorMessage(res));
        const data = (await res.json()) as NotificationsResponse;
        const incoming = Array.isArray(data.notifications) ? data.notifications : [];
        const nextCursor = typeof data.nextCursor === "string" ? data.nextCursor : null;
        const unread = typeof data.unreadCount === "number" ? data.unreadCount : 0;
        setState((prev) => {
          if (replace) {
            return { ...prev, notifications: incoming, nextCursor, unreadCount: unread };
          }
          // Merge, but keep the deepest pagination cursor the user has reached:
          // a poll must not rewind "Load more" back to page one.
          const keepCursor = prev.nextCursor != null && prev.notifications.length > limit;
          return {
            ...prev,
            notifications: mergeNotificationsById(prev.notifications, incoming),
            nextCursor: keepCursor ? prev.nextCursor : nextCursor,
            unreadCount: unread
          };
        });
        setError(null);
      } catch (err) {
        if (!quiet) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Something went wrong."
          }));
        }
      } finally {
        if (replace) setState((prev) => ({ ...prev, loading: false }));
        else setState((prev) => ({ ...prev, loadingMore: false }));
      }
    },
    [limit, unreadOnly, setError]
  );

  // Initial load, and re-load when the All/Unread toggle changes.
  useEffect(() => {
    if (!userId) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    void fetchPage({ replace: true });
  }, [userId, unreadOnly, fetchPage]);

  // Realtime: own filtered channel only (`notifications-<userId>`, RLS-fenced
  // server-side). INSERT rows merge by id — an id already present is replaced
  // (a row re-sent after mark-read reconciles its readAt; no duplicates ever
  // render) — and the unread count bumps only for genuinely new unread rows.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const record = rowToRecord(payload.new);
          if (!record) return;
          setState((prev) => {
            const known = prev.notifications.some((n) => n.id === record.id);
            return {
              ...prev,
              notifications: mergeNotificationsById(prev.notifications, [record]),
              unreadCount: known ? prev.unreadCount : prev.unreadCount + (record.readAt ? 0 : 1)
            };
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Polling fallback: 30s + on tab becoming visible (skip while hidden).
  // Quiet merges keep last good data on transient failures — Realtime is the
  // live path, this is the safety net. No short-interval polling.
  useEffect(() => {
    if (!userId) return;
    let inFlight = false;
    const refresh = () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      void fetchPage({ quiet: true }).finally(() => {
        inFlight = false;
      });
    };
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, fetchPage]);

  const markRead = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      const item = prev.notifications.find((n) => n.id === id);
      if (!item || item.readAt) return;
      const optimisticAt = new Date().toISOString();
      setState((s) => ({
        ...s,
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, readAt: optimisticAt } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1)
      }));
      void (async () => {
        try {
          const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
          });
          if (!res.ok) throw new Error("Could not mark as read.");
        } catch {
          // Revert the optimistic update, capped at the pre-op count (a
          // Realtime row may have arrived mid-flight); the 30s poll heals
          // any remaining drift.
          setState((s) => ({
            ...s,
            notifications: s.notifications.map((n) =>
              n.id === id ? { ...n, readAt: item.readAt } : n
            ),
            unreadCount: Math.min(prev.unreadCount, s.unreadCount + 1)
          }));
          setError("Could not mark notification as read.");
        }
      })();
    },
    [setError]
  );

  const markAllRead = useCallback(() => {
    const prev = stateRef.current;
    const unreadIds = prev.notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (unreadIds.length === 0 && prev.unreadCount === 0) return;
    const optimisticAt = new Date().toISOString();
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => (n.readAt ? n : { ...n, readAt: optimisticAt })),
      unreadCount: 0
    }));
    void (async () => {
      try {
        const res = await fetch("/api/notifications/read-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
        if (!res.ok) throw new Error("Could not mark all as read.");
        const data = (await res.json()) as { marked?: number | null } | null;
        const marked = typeof data?.marked === "number" ? data.marked : 0;
        // Reconcile with the server response: everything it marked is gone,
        // anything that arrived via Realtime mid-flight stays unread.
        setState((s) => ({
          ...s,
          unreadCount: Math.max(0, prev.unreadCount - Math.max(0, marked))
        }));
      } catch {
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) =>
            n.readAt === optimisticAt ? { ...n, readAt: null } : n
          ),
          unreadCount: Math.max(prev.unreadCount, s.unreadCount)
        }));
        setError("Could not mark notifications as read.");
      }
    })();
  }, [setError]);

  const loadMoreRef = useRef(false);
  const loadMore = useCallback(() => {
    const prev = stateRef.current;
    if (!prev.nextCursor || loadMoreRef.current) return;
    loadMoreRef.current = true;
    void fetchPage({ cursor: prev.nextCursor }).finally(() => {
      loadMoreRef.current = false;
    });
  }, [fetchPage]);

  const retry = useCallback(() => {
    void fetchPage({ replace: true });
  }, [fetchPage]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    loadingMore: state.loadingMore,
    hasMore: state.nextCursor != null,
    markRead,
    markAllRead,
    loadMore,
    retry
  };
}