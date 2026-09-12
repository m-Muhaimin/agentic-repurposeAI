"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectionsBuffer({
  connection
}: {
  connection: { bufferUsername: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyState, setApiKeyState] = useState<"idle" | "save" | "save_failed" | "remove">("idle");

  useEffect(() => {
    fetch("/api/integrations/buffer/api-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setHasApiKey(Boolean(body?.hasApiKey)))
      .catch(() => setHasApiKey(false));
  }, []);

  const connectedDate = connection?.createdAt
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
        new Date(connection.createdAt)
      )
    : null;

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/buffer/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not disconnect.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
      setDisconnecting(false);
    }
  }

  async function serverError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error) return body.error;
    } catch {
      // non-JSON body — fall through to the generic message
    }
    return fallback;
  }

  async function handleSaveApiKey() {
    const key = apiKeyInput.trim();
    if (!key) return;
    setApiKeyState("save");
    try {
      const res = await fetch("/api/integrations/buffer/api-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key })
      });
      if (!res.ok) throw new Error(await serverError(res, "Could not save the API key."));
      setHasApiKey(true);
      setApiKeyInput("");
      setApiKeyState("idle");
      router.refresh();
    } catch (err) {
      setApiKeyState("save_failed");
      setError(err instanceof Error ? err.message : "Could not save the API key.");
    }
  }

  async function handleRemoveApiKey() {
    setApiKeyState("remove");
    try {
      const res = await fetch("/api/integrations/buffer/api-key", { method: "DELETE" });
      if (!res.ok) throw new Error(await serverError(res, "Could not remove the API key."));
      setHasApiKey(false);
      setApiKeyState("idle");
      router.refresh();
    } catch (err) {
      setApiKeyState("idle");
      setError(err instanceof Error ? err.message : "Could not remove the API key.");
    }
  }

  return (
    <section className="flex flex-col rounded-lg border border-theme-divider bg-theme-bg-paper p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Buffer</h2>
        {connection ? (
          <span className="flex items-center gap-1.5 badge bg-neutral-900 text-white">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Connected
          </span>
        ) : (
          <span className="badge bg-neutral-100 text-neutral-600">Not connected</span>
        )}
      </div>

      {connection ? (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="font-display text-lg font-semibold text-theme-text-primary">
            @{connection.bufferUsername}
          </p>
          <p className="mt-0.5 text-sm text-theme-text-secondary">
            {connectedDate ? `Connected ${connectedDate}` : ""}
          </p>
          <p className="mt-3 text-sm text-theme-text-secondary">
            Post approved drafts to LinkedIn, X, TikTok, Instagram, and YouTube Shorts through your
            Buffer queue — never without your explicit approval.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="btn btn-outline-primary btn-sm disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col">
          <p className="text-sm text-theme-text-secondary">
            Connect a Buffer account so approved drafts can be posted to your channels — posting
            always waits for your explicit approval. You can still use the agent&apos;s scheduling
            features below with just an API key.
          </p>
          <a href="/api/integrations/buffer/connect" className="btn btn-primary mt-6 self-start">
            Connect Buffer
          </a>
        </div>
      )}

      <div className="mt-6 border-t border-theme-divider pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-semibold">Agent scheduling + metrics</h3>
          {hasApiKey === null ? (
            <span className="badge bg-neutral-100 text-neutral-600">…</span>
          ) : hasApiKey ? (
            <span className="badge bg-emerald-100 text-emerald-700">API key set</span>
          ) : (
            <span className="badge bg-neutral-100 text-neutral-600">No API key</span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-theme-text-secondary">
          Add a Buffer API key ({" "}
          <a
            href="https://publish.buffer.com/settings/api"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-theme-divider hover:decoration-current"
          >
            publish.buffer.com/settings/api
          </a>{" "}
          ) so automate mode can schedule drafts into your Buffer queue, repurpose existing posts,
          and pull post metrics. The key is encrypted at rest.
        </p>
        {hasApiKey ? (
          <button
            type="button"
            onClick={() => void handleRemoveApiKey()}
            disabled={apiKeyState === "remove"}
            className="btn btn-outline-primary btn-sm mt-4"
          >
            {apiKeyState === "remove" ? "Removing…" : "Remove API key"}
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Paste your Buffer API key"
              className="form-control flex-1"
            />
            <button
              type="button"
              onClick={() => void handleSaveApiKey()}
              disabled={!apiKeyInput.trim() || apiKeyState === "save"}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {apiKeyState === "save" ? "Saving…" : "Save key"}
            </button>
          </div>
        )}
        {apiKeyState === "save_failed" && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}