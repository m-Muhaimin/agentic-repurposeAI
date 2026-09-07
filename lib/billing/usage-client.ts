// Browser-only helpers shared by client components (dashboard, upload, settings).
// No server imports — pure fetch. Failures resolve to null so UI never crashes
// on a transient analytics/usage hiccup.

import type { EventName } from "@/lib/analytics/event-names";

export interface ClientUsage {
  plan: string;
  planName: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  atLimit: boolean;
  resetAt: string;
  windowLabel: string;
  maxInputMinutes: number;
  maxInputSeconds: number;
  maxOutputsPerJob: number;
  maxRegenerationsPerJob: number;
}

export async function getUsage(): Promise<ClientUsage | null> {
  try {
    const res = await fetch("/api/usage", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.usage ?? null;
  } catch {
    return null;
  }
}

export async function trackClient(name: EventName, properties: Record<string, unknown> = {}): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, properties })
    });
  } catch {
    // Never let analytics break the UI.
  }
}

export function formatResetDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}