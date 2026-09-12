"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { AgentPreferencesRow } from "@/lib/data";
import AgentDefaults from "./AgentDefaults";
import ApplyBar from "./ApplyBar";

type Props = {
  prefs: AgentPreferencesRow | null;
  children: ReactNode;
};

type Status = "idle" | "saving" | "saved" | "error";

type Patch = {
  autoMode?: boolean;
  tone?: string;
  forbidden?: string[];
  examples?: string[];
  samples?: string[];
};

/**
 * brand_samples is a TEXT column holding a JSON-encoded array (or null).
 * Guarded parse: arrays pass through, JSON strings are parsed, and a plain
 * string degrades to a single-sample list.
 */
function readSamples(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : [raw];
    } catch {
      return [raw];
    }
  }
  return [];
}

export default function PreferencesManager({ prefs, children }: Props) {
  const [autoMode, setAutoMode] = useState(
    (prefs?.auto_mode ?? "assist") !== "assist",
  );
  const [tone, setTone] = useState(prefs?.brand_tone ?? "");
  const [forbidden, setForbidden] = useState<string[]>(
    prefs?.brand_forbidden_phrases ?? [],
  );
  const [examples, setExamples] = useState<string[]>(
    prefs?.brand_examples ?? [],
  );
  const [samples, setSamples] = useState<string[]>(() =>
    readSamples(prefs?.brand_samples),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  // Mirrors `status` so async continuations can tell whether the user
  // discarded/reset/edited mid-flight before letting the result land.
  const statusRef = useRef<Status>("idle");
  const updateStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const applyPatch = (patch: Patch) => {
    if (patch.autoMode !== undefined) setAutoMode(patch.autoMode);
    if (patch.tone !== undefined) setTone(patch.tone);
    if (patch.forbidden !== undefined) setForbidden(patch.forbidden);
    if (patch.examples !== undefined) setExamples(patch.examples);
    if (patch.samples !== undefined) setSamples(patch.samples);
    updateStatus("idle");
  };

  const handleApply = async () => {
    updateStatus("saving");
    const client = createClient();
    const { data } = await client.auth.getUser();
    // Discard/reset/edit while signing in — don't stamp old state on top.
    if (statusRef.current !== "saving") return;
    const uid = data.user?.id;
    if (!uid) {
      updateStatus("error");
      setErrorText("Sign-in required to save preferences.");
      return;
    }
    const { error } = await client
      .from("v4_agent_preferences")
      .upsert(
        {
          user_id: uid,
          auto_mode: autoMode ? "execute" : "assist",
          brand_tone: tone,
          brand_forbidden_phrases: forbidden,
          brand_examples: examples,
          brand_samples: samples.length > 0 ? JSON.stringify(samples) : null,
        },
        { onConflict: "user_id" },
      );
    // Discard/reset/edit while the upsert was in flight — the payload was
    // captured before those changes, so ignore the stale result.
    if (statusRef.current !== "saving") return;
    if (error) {
      updateStatus("error");
      setErrorText(error.message);
      return;
    }
    updateStatus("saved");
  };

  const handleDiscard = () => {
    setAutoMode((prefs?.auto_mode ?? "assist") !== "assist");
    setTone(prefs?.brand_tone ?? "");
    setForbidden(prefs?.brand_forbidden_phrases ?? []);
    setExamples(prefs?.brand_examples ?? []);
    setSamples(readSamples(prefs?.brand_samples));
    updateStatus("idle");
  };

  const handleReset = () => {
    setAutoMode(false);
    setTone("");
    setForbidden([]);
    setExamples([]);
    setSamples([]);
    updateStatus("idle");
  };

  const matched = { agentDefaults: false, applyBar: false };

  const injectProps = (node: ReactNode): ReactNode =>
    Children.map(node, (child) => {
      if (!isValidElement(child)) return child;
      if (child.type === AgentDefaults) {
        matched.agentDefaults = true;
        return cloneElement(
          child as ReactElement<ComponentProps<typeof AgentDefaults>>,
          {
            autoMode,
            tone,
            forbidden,
            examples,
            samples,
            onChange: applyPatch,
            onReset: handleReset,
          },
        );
      }
      if (child.type === ApplyBar) {
        matched.applyBar = true;
        return cloneElement(
          child as ReactElement<ComponentProps<typeof ApplyBar>>,
          {
            status,
            errorText,
            onApply: handleApply,
            onDiscard: handleDiscard,
          },
        );
      }
      const nested = (child.props as { children?: ReactNode }).children;
      if (nested != null) {
        return cloneElement(
          child as ReactElement<{ children?: ReactNode }>,
          { children: injectProps(nested) },
        );
      }
      return child;
    });

  const rendered = injectProps(children);
  if (process.env.NODE_ENV === "development") {
    if (!matched.agentDefaults) {
      console.error(
        "PreferencesManager: <AgentDefaults /> not found in children — controlled props were not injected.",
      );
    }
    if (!matched.applyBar) {
      console.error(
        "PreferencesManager: <ApplyBar /> not found in children — apply props were not injected.",
      );
    }
  }

  return <>{rendered}</>;
}