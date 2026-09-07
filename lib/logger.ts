// Server-only structured JSON logger. No dependencies, no vendor lock-in:
// every line is one JSON object on stdout/stderr, and if LOG_WEBHOOK_URL is set
// the same line is fire-and-forget POSTed there (e.g. a free Slack/Hookdeck/
// Sentry-compatible webhook). Never log PII — use ids, statuses, and durations.

type LogLevel = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;
const THRESHOLD: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
const ORDER: LogLevel[] = ["info", "warn", "error"];

function shouldEmit(level: LogLevel): boolean {
  return ORDER.indexOf(level) >= ORDER.indexOf(THRESHOLD);
}

function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    const out: Fields = { message: err.message, name: err.name };
    if (err.stack) out.stack = err.stack;
    return out;
  }
  if (typeof err === "object" && err !== null) {
    const record = err as Record<string, unknown>;
    return {
      message: typeof record.message === "string" ? record.message : String(err),
      ...(record.code ? { code: String(record.code) } : {})
    };
  }
  return { message: String(err) };
}

function emit(level: LogLevel, event: string, fields: Fields): void {
  if (!shouldEmit(level)) return;
  const line: Fields = { ts: new Date().toISOString(), level, event, ...fields };
  const json = JSON.stringify(line);
  if (level === "error") console.error(json);
  else if (level === "warn") console.warn(json);
  else console.log(json);

  if (!WEBHOOK_URL) return;
  // Fire-and-forget: a broken/absent webhook must never break the app.
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: json,
    keepalive: true
  }).catch(() => {});
}

export const log = {
  info(event: string, fields: Fields = {}): void {
    emit("info", event, fields);
  },
  warn(event: string, fields: Fields = {}): void {
    emit("warn", event, fields);
  },
  error(event: string, err: unknown, fields: Fields = {}): void {
    emit("error", event, { ...serializeError(err), ...fields });
  }
};

export type { LogLevel };