// Tiny Intl.RelativeTimeFormat helper for notification timestamps ("5 minutes
// ago", "yesterday"). Pure so it is trivially testable; the 60s refresh ticker
// lives in the component that mounts the label (notification-item.tsx), so
// timestamps only re-render while the list is actually on screen.

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60]
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTimeLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSeconds = Math.round((then - now) / 1000);
  // Future timestamps are clock skew — never render "in 5 minutes".
  if (diffSeconds > 0) return "just now";
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return "just now";
  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "just now";
}