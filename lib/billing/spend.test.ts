import { describe, it, expect, vi } from "vitest";
import {
  computeDailySpend,
  computeErrorRate,
  evaluateSpendAlerts,
  SPEND_LOOKBACK_DAYS,
  type DaySpend,
  type DayErrors
} from "@/lib/billing/spend";

const NOW = new Date(Date.UTC(2026, 8, 8, 0, 0, 0));

function freezeDate(date: Date) {
  vi.stubGlobal("Date", class extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) return date;
      super(...(args as ConstructorParameters<DateConstructor>));
    }
    static now() {
      return date.getTime();
    }
  });
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

describe("lib/billing/spend", () => {
  describe("computeDailySpend", () => {
    it("returns empty days and zero totals when no events exist", async () => {
      freezeDate(NOW);
      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: [], error: null })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { computeDailySpend: fn } = await import("@/lib/billing/spend");
      const result = await fn("user-1", SPEND_LOOKBACK_DAYS, NOW);
      expect(result.days).toHaveLength(SPEND_LOOKBACK_DAYS);
      expect(result.totals).toEqual<Omit<DaySpend, "date">>({
        jobsReserved: 0,
        jobsConsumed: 0,
        jobsRefunded: 0,
        jobsReleased: 0,
        billedJobs: 0,
        inputTokens: 0,
        outputTokens: 0
      });
      expect(result.days[0].date).toBe("2026-08-10");
      expect(result.days[result.days.length - 1].date).toBe("2026-09-08");
    });

    it("aggregates actions into daily spend with billedJobs math", async () => {
      const now = new Date(Date.UTC(2026, 8, 8, 11, 0, 0));
      freezeDate(now);
      const todayKey = dateKey(now);
      const events = [
        { action: "reserve", created_at: `${todayKey}T10:00:00.000Z` },
        { action: "reserve", created_at: `${todayKey}T11:00:00.000Z` },
        { action: "consume", created_at: `${todayKey}T11:30:00.000Z` },
        { action: "refund", created_at: `${todayKey}T11:45:00.000Z` },
        { action: "release", created_at: `${todayKey}T11:59:00.000Z` }
      ];

      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: events, error: null })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { computeDailySpend: fn } = await import("@/lib/billing/spend");
      const result = await fn("user-1", SPEND_LOOKBACK_DAYS, now);

      const today = result.days.find((d) => d.date === todayKey);
      expect(today).toBeTruthy();
      expect(today!.jobsReserved).toBe(2);
      expect(today!.jobsConsumed).toBe(1);
      expect(today!.jobsRefunded).toBe(1);
      expect(today!.jobsReleased).toBe(1);
      expect(today!.billedJobs).toBe(0);
      expect(result.totals.billedJobs).toBe(0);
    });

    it("handles DB query errors gracefully", async () => {
      freezeDate(NOW);
      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: null, error: new Error("db down") })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { computeDailySpend: fn } = await import("@/lib/billing/spend");
      const result = await fn("user-1", SPEND_LOOKBACK_DAYS, NOW);
      expect(result.totals.billedJobs).toBe(0);
      expect(result.days).toHaveLength(SPEND_LOOKBACK_DAYS);
    });
  });

  describe("computeErrorRate", () => {
    it("counts failed jobs and computes error rate per day", async () => {
      freezeDate(NOW);
      const todayKey = "2026-09-08";
      const jobs = [
        { status: "completed", created_at: `${todayKey}T01:00:00.000Z` },
        { status: "completed", created_at: `${todayKey}T02:00:00.000Z` },
        { status: "failed", created_at: `${todayKey}T03:00:00.000Z` },
        { status: "failed", created_at: `${todayKey}T04:00:00.000Z` }
      ];

      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: jobs, error: null })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { computeErrorRate: fn } = await import("@/lib/billing/spend");
      const result = await fn("user-1", SPEND_LOOKBACK_DAYS, NOW);

      const today = result.days.find((d) => d.date === todayKey);
      expect(today).toBeTruthy();
      expect(today!.totalJobs).toBe(4);
      expect(today!.failedJobs).toBe(2);
      expect(today!.errorRate).toBeCloseTo(0.5, 4);
      expect(result.overall.errorRate).toBeCloseTo(0.5, 4);
    });

    it("returns zero on DB error", async () => {
      freezeDate(NOW);
      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: null, error: new Error("boom") })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { computeErrorRate: fn } = await import("@/lib/billing/spend");
      const result = await fn("user-1", SPEND_LOOKBACK_DAYS, NOW);
      expect(result.overall.errorRate).toBe(0);
      expect(result.days).toHaveLength(SPEND_LOOKBACK_DAYS);
    });
  });

  describe("evaluateSpendAlerts", () => {
    it("emits warn alert on high daily billed jobs", async () => {
      freezeDate(NOW);
      const todayKey = "2026-09-08";
      const events = Array.from({ length: 12 }, () => ({
        action: "reserve",
        created_at: `${todayKey}T12:00:00.000Z`
      }));

      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: events, error: null })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { evaluateSpendAlerts: fn } = await import("@/lib/billing/spend");
      const alerts = await fn("user-1", NOW);
      expect(alerts.map((a) => a.metric)).toContain("daily_billed_jobs");
    });

    it("emits error alert when error rate crosses threshold", async () => {
      freezeDate(NOW);
      const todayKey = "2026-09-08";
      const jobs = [
        { status: "failed", created_at: `${todayKey}T01:00:00.000Z` },
        { status: "completed", created_at: `${todayKey}T02:00:00.000Z` },
        { status: "failed", created_at: `${todayKey}T03:00:00.000Z` },
        { status: "failed", created_at: `${todayKey}T04:00:00.000Z` }
      ];

      vi.resetModules();
      vi.doMock("@/lib/supabase/server", () => ({
        createServiceClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () => Promise.resolve({ data: jobs, error: null })
                })
              })
            })
          })
        }),
        createClient: () => ({} as any)
      }));
      const { evaluateSpendAlerts: fn } = await import("@/lib/billing/spend");
      const alerts = await fn("user-1", NOW);
      const metrics = alerts.map((a) => a.metric);
      expect(metrics).toContain("error_rate");
    });
  });
});
