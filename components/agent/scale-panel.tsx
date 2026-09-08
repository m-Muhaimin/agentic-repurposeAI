"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { AGENT_MODE_LABEL } from "@/types/agent";

// Scale panel (P13). READ-ONLY surface of the permission model. It asserts the
// structural fact that no autopilot door exists in this build and renders each
// mode's capabilities as honest booleans — from the server, never the client.

interface ModeScaleSummary {
  mode: string;
  canDistribute: boolean;
  canStrategize: boolean;
  canAutoRevise: boolean;
  requiresHumanApproval: boolean;
  channelsConnected: boolean;
}

interface ScaleData {
  ok: boolean;
  planId: string;
  planName: string;
  defaultMode: string;
  modes: ModeScaleSummary[];
  autopilotDoorExists: boolean;
  scheduleIsDraftOnly: boolean;
  note: string;
}

export default function ScalePanel() {
  const [data, setData] = useState<ScaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScale = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/scale");
      if (res.ok) {
        const body = (await res.json()) as ScaleData;
        if (body.ok) setData(body);
      } else {
        setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
      }
    } catch {
      setError("VervAI couldn't complete this action. Your content is safe. [Try again]");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScale();
  }, [fetchScale]);

  return (
    <Card>
      <CardHeader
        title="Scale"
        description={
          data
            ? `${data.planName} plan · default: ${AGENT_MODE_LABEL[data.defaultMode as keyof typeof AGENT_MODE_LABEL] ?? data.defaultMode}`
            : "VervAI permission model overview."
        }
      />

      {loading && <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100 px-5 py-6" />}

      {!loading && error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <>
          <ul className="divide-y divide-theme-divider">
            {data.modes.map((m) => (
              <li key={m.mode} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm font-medium">
                  {AGENT_MODE_LABEL[m.mode as keyof typeof AGENT_MODE_LABEL] ??
                    m.mode.charAt(0).toUpperCase() + m.mode.slice(1)}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`badge ${m.canStrategize ? "bg-primary-100 text-primary-500" : "bg-neutral-200 text-neutral-500"}`}>
                    strategize
                  </span>
                  <span className={`badge ${m.canDistribute ? "bg-primary-100 text-primary-500" : "bg-neutral-200 text-neutral-500"}`}>
                    distribute
                  </span>
                  <span className={`badge ${m.canAutoRevise ? "bg-primary-100 text-primary-500" : "bg-neutral-200 text-neutral-500"}`}>
                    revise
                  </span>
                  {m.requiresHumanApproval && (
                    <span className="badge bg-amber-100 text-amber-600">human approval</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {data.autopilotDoorExists ? (
            <p className="px-5 pb-2 text-xs text-amber-600">Autopilot is reachable — review before this ships.</p>
          ) : (
            <p className="px-5 pb-2 text-xs text-theme-text-secondary">
              No autopilot door exists: no worker auto-advances a queued job, and schedules are draft-only.
            </p>
          )}

          {!data.scheduleIsDraftOnly && (
            <p className="px-5 pb-2 text-xs text-amber-600">Schedules auto-send — this must be reviewed.</p>
          )}

          <div className="border-t border-theme-divider px-5 py-3">
            <p className="text-xs text-theme-text-secondary">{data.note}</p>
          </div>
        </>
      )}
    </Card>
  );
}