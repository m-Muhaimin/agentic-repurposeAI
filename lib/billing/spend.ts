import { createServiceClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

export interface DaySpend {
  date: string; // ISO YYYY-MM-DD
  jobsReserved: number;
  jobsConsumed: number;
  jobsRefunded: number;
  jobsReleased: number;
  billedJobs: number; // reserve - refund - release
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number; // reserved for future per-model pricing
}

export interface DayErrors {
  date: string;
  failedJobs: number;
  hardErrors: number;
  totalJobs: number;
  totalEvents: number;
  errorRate: number; // 0..1
}

export interface SpendSummary {
  days: DaySpend[];
  totals: Omit<DaySpend, "date">;
}

export interface ErrorRateSummary {
  days: DayErrors[];
  overall: Omit<DayErrors, "date" | "errorRate"> & { errorRate: number };
}

export const SPEND_LOOKBACK_DAYS = 30;

function buildRange(days: number, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function computeDailySpend(
  userId: string,
  days = SPEND_LOOKBACK_DAYS,
  now?: Date
): Promise<SpendSummary> {
  const service = createServiceClient();
  const { start, end } = buildRange(days, now);

  const daysMap = new Map<string, DaySpend>();

  for (let i = 0; i < days; i++) {
    const d = new Date(end.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    daysMap.set(dayKey(d), {
      date: dayKey(d),
      jobsReserved: 0,
      jobsConsumed: 0,
      jobsRefunded: 0,
      jobsReleased: 0,
      billedJobs: 0,
      inputTokens: 0,
      outputTokens: 0
    });
  }

  try {
    const { data: events, error: eventsError } = await service
      .from("usage_events")
      .select("action, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (eventsError) {
      log.warn("spend.usage_events_query_failed", { error: eventsError.message, user_id: userId });
    }

    for (const ev of events ?? []) {
      const key = dayKey(new Date((ev.created_at as string)));
      const bucket = daysMap.get(key);
      if (!bucket) continue;
      switch (ev.action) {
        case "reserve":
          bucket.jobsReserved += 1;
          break;
        case "consume":
          bucket.jobsConsumed += 1;
          break;
        case "refund":
          bucket.jobsRefunded += 1;
          break;
        case "release":
          bucket.jobsReleased += 1;
          break;
      }
    }
  } catch (err) {
    log.warn("spend.usage_events_query_exception", {
      error: err instanceof Error ? err.message : String(err),
      user_id: userId
    });
  }

  const daysArr = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const d of daysArr) {
    d.billedJobs = d.jobsReserved - d.jobsRefunded - d.jobsReleased;
    if (d.billedJobs < 0) d.billedJobs = 0;
  }

  const totals: Omit<DaySpend, "date"> = daysArr.reduce(
    (acc, d) => {
      acc.jobsReserved += d.jobsReserved;
      acc.jobsConsumed += d.jobsConsumed;
      acc.jobsRefunded += d.jobsRefunded;
      acc.jobsReleased += d.jobsReleased;
      acc.billedJobs += d.billedJobs;
      acc.inputTokens += d.inputTokens;
      acc.outputTokens += d.outputTokens;
      return acc;
    },
    { jobsReserved: 0, jobsConsumed: 0, jobsRefunded: 0, jobsReleased: 0, billedJobs: 0, inputTokens: 0, outputTokens: 0 }
  );

  return { days: daysArr, totals };
}

export async function computeErrorRate(
  userId: string,
  days = SPEND_LOOKBACK_DAYS,
  now?: Date
): Promise<ErrorRateSummary> {
  const service = createServiceClient();
  const current = now ?? new Date();
  const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const daysMap = new Map<string, DayErrors>();

  for (let i = 0; i < days; i++) {
    const d = new Date(end.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    daysMap.set(key, { date: key, failedJobs: 0, hardErrors: 0, totalJobs: 0, totalEvents: 0, errorRate: 0 });
  }

  try {
    const { data: jobs, error: jobsError } = await service
      .from("jobs")
      .select("status, created_at")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (jobsError) {
      log.warn("spend.jobs_query_failed", { error: jobsError.message, user_id: userId });
    }

    let total = 0;
    let failed = 0;
    for (const job of jobs ?? []) {
      const key = (job.created_at as string).slice(0, 10);
      const bucket = daysMap.get(key);
      if (!bucket) continue;
      bucket.totalJobs += 1;
      total += 1;
      if (job.status === "failed") {
        bucket.failedJobs += 1;
        failed += 1;
      }
    }

    const daysArr = Array.from(daysMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, errorRate: d.totalJobs ? d.failedJobs / d.totalJobs : 0 }));

    return {
      days: daysArr,
      overall: { failedJobs: failed, hardErrors: 0, totalJobs: total, totalEvents: total, errorRate: total ? failed / total : 0 }
    };
  } catch (err) {
    log.warn("spend.error_rate_exception", {
      error: err instanceof Error ? err.message : String(err),
      user_id: userId
    });
    return {
      days: Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      overall: { failedJobs: 0, hardErrors: 0, totalJobs: 0, totalEvents: 0, errorRate: 0 }
    };
  }
}

export interface SpendAlert {
  level: "info" | "warn" | "error";
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

export async function evaluateSpendAlerts(userId: string, now?: Date): Promise<SpendAlert[]> {
  const [spend, errorRate] = await Promise.all([
    computeDailySpend(userId, SPEND_LOOKBACK_DAYS, now),
    computeErrorRate(userId, SPEND_LOOKBACK_DAYS, now)
  ]);
  const alerts: SpendAlert[] = [];

  const today = spend.days[spend.days.length - 1];
  if (today && today.billedJobs >= 10) {
    alerts.push({
      level: "warn",
      message: "User hit heavy daily job usage.",
      metric: "daily_billed_jobs",
      value: today.billedJobs,
      threshold: 10
    });
    log.warn("spend.alert.daily_jobs", { user_id: userId, value: today.billedJobs, threshold: 10 });
  }

  if (errorRate.overall.errorRate >= 0.2) {
    alerts.push({
      level: "error",
      message: "Elevated job failure rate detected.",
      metric: "error_rate",
      value: Number(errorRate.overall.errorRate.toFixed(4)),
      threshold: 0.2
    });
    log.error("spend.alert.error_rate", new Error("error_rate_above_threshold"), {
      user_id: userId,
      value: Number(errorRate.overall.errorRate.toFixed(4)),
      threshold: 0.2
    });
  }

  return alerts;
}
