// Unit tests for the outcome-centric run composer mappings — pure module.

import { describe, expect, it } from "vitest";
import {
  AGENT_INTENTS,
  AGENT_INTENT_DEFS,
  isAgentIntent,
  defaultModeFor,
  detectIntent,
  intentStartsRun,
  isValidGoal,
  sourceRequiredFor,
  summarizeGoal,
  userChoosesSourceFor
} from "@/lib/agent/outcomes";

describe("intent vocabulary", () => {
  it("exposes the six intents and they are stable", () => {
    expect(AGENT_INTENTS).toEqual(["create", "plan", "repurpose", "improve", "find_opportunities", "build_week"]);
  });

  it("every intent has a definition in the map", () => {
    for (const id of AGENT_INTENTS) {
      expect(AGENT_INTENT_DEFS[id].id).toBe(id);
      expect(AGENT_INTENT_DEFS[id].chip.length).toBeGreaterThan(0);
      expect(AGENT_INTENT_DEFS[id].headline.length).toBeGreaterThan(0);
      expect(AGENT_INTENT_DEFS[id].detail.length).toBeGreaterThan(0);
    }
  });

  it("isAgentIntent guards unknown ids", () => {
    expect(isAgentIntent("create")).toBe(true);
    expect(isAgentIntent("find_opportunities")).toBe(true);
    expect(isAgentIntent("publish")).toBe(false);
    expect(isAgentIntent(undefined)).toBe(false);
  });
});

describe("source requirements", () => {
  it("the run machine needs a source for every run intent", () => {
    for (const id of AGENT_INTENTS) {
      if (id === "find_opportunities") {
        expect(sourceRequiredFor(id)).toBe(false);
      } else {
        expect(sourceRequiredFor(id)).toBe(true);
      }
    }
  });

  it("planning-style intents never gate the user on picking a source", () => {
    expect(userChoosesSourceFor("create")).toBe(false);
    expect(userChoosesSourceFor("plan")).toBe(false);
    expect(userChoosesSourceFor("build_week")).toBe(false);
    expect(userChoosesSourceFor("repurpose")).toBe(true);
    expect(userChoosesSourceFor("improve")).toBe(true);
  });

  it("only find_opportunities is a surface action, not a run", () => {
    expect(intentStartsRun("create")).toBe(true);
    expect(intentStartsRun("build_week")).toBe(true);
    expect(intentStartsRun("find_opportunities")).toBe(false);
  });
});

describe("defaultAutonomy", () => {
  it("improve defaults to execution autonomy", () => {
    expect(defaultModeFor("improve")).toBe("execute");
  });

  it("everything else defaults to assist-by-example", () => {
    for (const id of AGENT_INTENTS) {
      if (id !== "improve") {
        expect(defaultModeFor(id)).toBe("assist");
      }
    }
  });
});

describe("detectIntent", () => {
  it("responds to the weekly builder", () => {
    expect(detectIntent("Build next week's posts")).toBe("build_week");
    expect(detectIntent("my weekly newsletter")).toBe("build_week");
  });

  it("responds to opportunity language", () => {
    expect(detectIntent("What should I work on next?")).toBe("find_opportunities");
    expect(detectIntent("Find the biggest opportunity")).toBe("find_opportunities");
  });

  it("prefers the most specific intent", () => {
    expect(detectIntent("Improve and repurpose my old recording")).toBe("improve");
  });

  it("responds to planning and repurposing", () => {
    expect(detectIntent("Plan the angles")).toBe("plan");
    expect(detectIntent("Repurpose this podcast")).toBe("repurpose");
  });

  it("falls back to creation for generic content goals", () => {
    expect(detectIntent("Write content about AI tools")).toBe("create");
    expect(detectIntent("Create a post")).toBe("create");
  });

  it("returns null for empty or unrelated text", () => {
    expect(detectIntent("")).toBeNull();
    expect(detectIntent("hello world")).toBeNull();
  });

  it("orders most-specific over generic", () => {
    // "improve" is more specific than "plan", so it wins the suggestion.
    expect(detectIntent("Plan angles and improve them")).toBe("improve");
    // "plan" is checked before "repurpose" — explicit planning stays a plan.
    expect(detectIntent("Plan a repurposing series")).toBe("plan");
  });
});

describe("summarizeGoal", () => {
  it("normalizes whitespace and trims", () => {
    expect(summarizeGoal("  create   next  week's\ncontent  ")).toBe("create next week's content");
  });

  it("caps long goals and appends an ellipsis", () => {
    const long = "a".repeat(120);
    expect(summarizeGoal(long)).toBe(`${"a".repeat(79)}…`);
    expect(summarizeGoal(long).length).toBe(80);
  });

  it("keeps a goal the machine can display", () => {
    expect(summarizeGoal("Build a launch series")).toBe("Build a launch series");
    expect(summarizeGoal("   ")).toBe("");
  });
});

describe("isValidGoal", () => {
  it("requires at least one meaningful word", () => {
    expect(isValidGoal("Create a LinkedIn series")).toBe(true);
    expect(isValidGoal("a a")).toBe(false);
    expect(isValidGoal("")).toBe(false);
  });
});