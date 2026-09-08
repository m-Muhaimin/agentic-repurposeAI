// Phase 1: lifecycle mapping tests — canonical stages ⇄ persisted enums.

import { describe, expect, it } from "vitest";
import {
  canTransition,
  sourceStatusToStage,
  stageToSourceStatus,
  stageToTranscriptStatus,
  transcriptStatusToStage,
  STAGES_PER_SOURCE_TYPE
} from "@/lib/ingestion/lifecycle";

describe("stageToSourceStatus", () => {
  it("collapses pre-ready stages onto the worker's 'transcribing' transition", () => {
    expect(stageToSourceStatus("initiated")).toBe("transcribing");
    expect(stageToSourceStatus("retrieving")).toBe("transcribing");
    expect(stageToSourceStatus("ingesting")).toBe("transcribing");
    expect(stageToSourceStatus("transcribing")).toBe("transcribing");
    expect(stageToSourceStatus("producing")).toBe("transcribing");
  });

  it("maps ready/failed onto the persisted enum", () => {
    expect(stageToSourceStatus("ready")).toBe("transcribed");
    expect(stageToSourceStatus("failed")).toBe("failed");
  });
});

describe("stageToTranscriptStatus", () => {
  it("keeps pre-production stages as processing (row not yet written)", () => {
    expect(stageToTranscriptStatus("retrieving")).toBe("processing");
    expect(stageToTranscriptStatus("producing")).toBe("processing");
  });

  it("maps ready/failed", () => {
    expect(stageToTranscriptStatus("ready")).toBe("ready");
    expect(stageToTranscriptStatus("failed")).toBe("failed");
  });
});

describe("reverse mappings (existing rows rendered as stages)", () => {
  it("round-trips via sourceStatusToStage", () => {
    expect(sourceStatusToStage("uploaded")).toBe("initiated");
    expect(sourceStatusToStage("transcribing")).toBe("transcribing");
    expect(sourceStatusToStage("transcribed")).toBe("ready");
    expect(sourceStatusToStage("generating")).toBe("ready");
    expect(sourceStatusToStage("done")).toBe("ready");
    expect(sourceStatusToStage("failed")).toBe("failed");
  });

  it("round-trips via transcriptStatusToStage", () => {
    expect(transcriptStatusToStage("processing")).toBe("transcribing");
    expect(transcriptStatusToStage("ready")).toBe("ready");
    expect(transcriptStatusToStage("failed")).toBe("failed");
  });
});

describe("canTransition", () => {
  it("allows forward progress along the chain", () => {
    expect(canTransition("initiated", "retrieving")).toBe(true);
    expect(canTransition("ingesting", "transcribing")).toBe(true);
    expect(canTransition("producing", "ready")).toBe(true);
  });

  it("allows skips", () => {
    expect(canTransition("initiated", "ready")).toBe(true);
  });

  it("allows failing from any active stage", () => {
    expect(canTransition("retrieving", "failed")).toBe(true);
    expect(canTransition("ready", "failed")).toBe(true);
  });

  it("blocks regressions, loops, and no-ops", () => {
    expect(canTransition("ready", "initiated")).toBe(false);
    expect(canTransition("ready", "producing")).toBe(false);
    expect(canTransition("transcribing", "transcribing")).toBe(false);
    expect(canTransition("failed", "failed")).toBe(false);
    expect(canTransition("failed", "ready")).toBe(false);
  });
});

describe("STAGES_PER_SOURCE_TYPE", () => {
  it("declares stage plans for every current source type", () => {
    expect(STAGES_PER_SOURCE_TYPE.youtube).toEqual(["retrieving", "ingesting", "producing", "ready"]);
    expect(STAGES_PER_SOURCE_TYPE.audio).toEqual(["retrieving", "transcribing", "producing", "ready"]);
    expect(STAGES_PER_SOURCE_TYPE.video).toEqual(["retrieving", "transcribing", "producing", "ready"]);
    expect(STAGES_PER_SOURCE_TYPE.transcript).toEqual(["ingesting", "producing", "ready"]);
  });
});