"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function FeaturesContent() {
  return (
    <div className="pt-14">
      {/* SECTION 1: ARCHITECTURAL HERO & TELEMETRY STRIP */}
      <section className="relative w-full pt-12 pb-16 px-6 lg:px-12 bg-surface overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-start">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-high text-secondary font-caption-bold text-caption-bold tracking-wide uppercase mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>System Specifications v4.2 • Zero-Config Ingestion</span>
          </div>
          {/* Main Header Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end w-full mb-12">
            <div className="lg:col-span-8">
              <h1 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-4 max-w-4xl">
                Architectural Features: Built for Sovereign Creators &amp;
                High-Velocity Desks
              </h1>
              <p className="font-body-base text-body-base text-on-surface-variant max-w-3xl leading-relaxed">
                Explore the deep modular infrastructure turning unstructured
                voice notes, executive podcasts, product Looms, and whitepapers
                into high-leverage multi-channel narratives without stylistic
                erosion.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end items-start lg:items-end">
              <Link
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg bg-primary-container text-on-primary font-body-medium text-body-medium hover:bg-primary transition-colors shadow-md active:scale-[0.98]"
                href="/sign-up"
              >
                <span>Spin Up Pipeline Instance</span>
                <Icon name="arrow_forward" size={18} />
              </Link>
              <span className="font-caption-bold text-caption-bold text-secondary">
                Stateless Ingestion • SOC-2 Type II Certified
              </span>
            </div>
          </div>
          {/* Capability Ribbon */}
          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-container-low shadow-sm">
            <div className="p-4 rounded-lg bg-surface-container-lowest flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-label-caps uppercase text-secondary">
                  Agent Graph
                </span>
                <Icon name="hub" size={18} className="text-primary" />
              </div>
              <div className="font-display-xl text-display-xl text-on-surface tracking-tight">
                Multi-Agent
              </div>
              <span className="font-body-sm text-body-sm text-tertiary mt-1 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>{" "}
                Concurrent DAG Execution
              </span>
            </div>
            <div className="p-4 rounded-lg bg-surface-container-lowest flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-label-caps uppercase text-secondary">
                  Dispatch
                </span>
                <Icon name="speed" size={18} className="text-primary" />
              </div>
              <div className="font-display-xl text-display-xl text-on-surface tracking-tight">
                Low-Latency
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Deterministic Execution
              </span>
            </div>
            <div className="p-4 rounded-lg bg-surface-container-lowest flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-label-caps uppercase text-secondary">
                  Cadence
                </span>
                <Icon name="verified" size={18} className="text-primary" />
              </div>
              <div className="font-display-xl text-display-xl text-on-surface tracking-tight">
                Deterministic
              </div>
              <span className="font-body-sm text-body-sm text-tertiary mt-1 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>{" "}
                Checkpointed State Runs
              </span>
            </div>
            <div className="p-4 rounded-lg bg-surface-container-lowest flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-caps text-label-caps uppercase text-secondary">
                  Lexical Guard
                </span>
                <Icon
                  name="filter_alt"
                  size={18}
                  className="text-tertiary"
                />
              </div>
              <div className="font-display-xl text-display-xl text-on-surface tracking-tight">
                Zero-Jargon
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Banned-Word Control
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: BENTO GRID OF CORE ENGINE ARCHITECTURE */}
      <section className="w-full py-12 px-6 lg:px-12 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="font-label-caps text-label-caps uppercase text-secondary tracking-widest block mb-1">
                Infrastructure Matrix
              </span>
              <h2 className="font-display-xl text-display-xl text-on-surface">
                The Sovereign Production Engine
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
              Structured state machines, non-linear reasoning, and strict
              deterministic compilers replace naive black-box prompting.
            </p>
          </div>
          {/* Bento Container */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* CARD 1 (8 Columns): 7-Stage DAG Pipeline */}
            <div className="lg:col-span-8 rounded-xl bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 mb-4 bg-surface-container-low -mx-6 -mt-6 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Icon
                    name="account_tree"
                    size={22}
                    className="text-primary-container"
                  />
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      7-Stage Directed Acyclic Graph (DAG) Pipeline
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Durable state machine checkpointed via persistent Redis
                      memory registers
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                  DAG Orchestrator
                </span>
              </div>
              {/* Pipeline Stages */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 my-4">
                {/* Stage 1 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 01
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Ingest
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-tertiary">
                      Multi-codec
                    </span>
                    <Icon
                      name="done_all"
                      size={16}
                      className="text-tertiary"
                    />
                  </div>
                </div>
                {/* Stage 2 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 02
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Understand
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-tertiary">
                      Phonetics
                    </span>
                    <Icon
                      name="graphic_eq"
                      size={16}
                      className="text-tertiary"
                    />
                  </div>
                </div>
                {/* Stage 3 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 03
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Intelligence
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-tertiary">
                      Extraction
                    </span>
                    <Icon
                      name="psychology"
                      size={16}
                      className="text-primary"
                    />
                  </div>
                </div>
                {/* Stage 4 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 04
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Opps
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-primary">
                      Surface Map
                    </span>
                    <Icon name="radar" size={16} className="text-primary" />
                  </div>
                </div>
                {/* Stage 5 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 05
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Recs
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Channel fit
                    </span>
                    <Icon
                      name="lightbulb"
                      size={16}
                      className="text-secondary"
                    />
                  </div>
                </div>
                {/* Stage 6 */}
                <div className="p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between">
                  <div>
                    <span className="font-label-caps text-label-caps text-secondary block mb-1">
                      STAGE 06
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface block">
                      Plan
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Matrix assembly
                    </span>
                    <Icon
                      name="calendar_view_week"
                      size={16}
                      className="text-secondary"
                    />
                  </div>
                </div>
                {/* Stage 7 */}
                <div className="p-3 rounded-lg bg-primary-fixed text-on-primary-fixed flex flex-col justify-between shadow-sm">
                  <div>
                    <span className="font-label-caps text-label-caps text-primary-container block mb-1">
                      STAGE 07
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-primary-fixed block">
                      Approval
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-caption-bold text-caption-bold text-primary">
                      Verified
                    </span>
                    <Icon
                      name="fact_check"
                      size={16}
                      className="text-primary"
                    />
                  </div>
                </div>
              </div>
              {/* Console Checkpoint Streaming Box */}
              <div className="rounded-lg bg-surface-container p-4 font-mono text-[12px] leading-relaxed text-on-surface flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between text-secondary pb-2 mb-1">
                  <span className="font-label-caps text-label-caps tracking-wider uppercase text-secondary">
                    Pipeline Checkpoint Stream
                  </span>
                  <span className="font-caption-bold text-caption-bold text-primary">
                    Checkpoints • Persistent State
                  </span>
                </div>
                <div className="text-on-surface-variant flex items-center gap-2">
                  <span className="text-on-surface">
                    INGESTION_RESOLVED:
                  </span>
                  <span>
                    Source unpacked and normalized across supported formats.
                  </span>
                </div>
                <div className="text-on-surface-variant flex items-center gap-2">
                  <span className="text-on-surface">
                    ACOUSTIC_ALIGNMENT:
                  </span>
                  <span>
                    Multi-speaker roles separated with aligned timestamps.
                  </span>
                </div>
                <div className="text-on-surface-variant flex items-center gap-2">
                  <span className="text-on-surface">
                    SYNTHESIS_PIPELINE:
                  </span>
                  <span>
                    Channel-native artifacts compiled for downstream review.
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 2 (4 Columns): Strict Brand Voice & LoRA Tuning */}
            <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                    <Icon name="tune" size={20} />
                  </div>
                  <span className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
                    Calibration Engine
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  Strict Brand Voice &amp; LoRA Tuning
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  Mathematical tone calibration eliminates generic AI inflections
                  while enforcing structural narrative identity.
                </p>
                {/* Sliders */}
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between font-caption-bold text-caption-bold mb-1.5">
                      <span className="text-secondary">
                        Analytical vs Emotional
                      </span>
<span className="text-primary">
                    Analytical-Leaning
                  </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: "85%" }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-caption-bold text-caption-bold mb-1.5">
                      <span className="text-secondary">
                        Punchiness vs Exposition
                      </span>
<span className="text-primary">
                    Concise-Leaning
                  </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-container rounded-full"
                        style={{ width: "78%" }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-caption-bold text-caption-bold mb-1.5">
                      <span className="text-secondary">
                        Structural Formality Matrix
                      </span>
                      <span className="text-on-surface">
                        High-Impact Technical
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full"
                        style={{ width: "92%" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Intercepted Lexicon Badges */}
              <div className="pt-4 bg-surface-container-low -mx-6 px-6 pb-2 rounded-b-xl">
                <span className="font-label-caps text-label-caps text-error block mb-2 tracking-wider uppercase flex items-center gap-1">
                  <Icon name="block" size={14} />
                  Negative Lexical Interceptor Active
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary line-through font-caption-bold text-caption-bold">
                    delve
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary line-through font-caption-bold text-caption-bold">
                    synergy
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary line-through font-caption-bold text-caption-bold">
                    game-changer
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary line-through font-caption-bold text-caption-bold">
                    tapestry
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-highest text-secondary line-through font-caption-bold text-caption-bold">
                    beacon
                  </span>
                </div>
              </div>
            </div>

            {/* CARD 3 (4 Columns): Whisper-v3 Neural Diarization */}
            <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                    <Icon name="mic" size={20} />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-caps text-label-caps tracking-wider uppercase">
                    Whisper-v3 Pro
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  Neural Diarization &amp; Timestamps
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Microsecond acoustic segmentation separates multi-guest
                  dialogue, suppressing studio bleed and ambient distortion.
                </p>
                {/* Visual Diarization Trace */}
                <div className="space-y-2.5 p-3 rounded-lg bg-surface-container-low">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center font-caption-bold text-caption-bold text-on-primary-fixed">
                      01
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center text-secondary font-caption-bold text-caption-bold mb-0.5">
                        <span>Speaker A (Host)</span>
                        <span className="font-mono">Voice Track</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface leading-tight">
                        Per-speaker transcript attribution keeps every quote
                        anchored to its source.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pt-2">
                    <span className="w-6 h-6 rounded-full bg-secondary-fixed flex items-center justify-center font-caption-bold text-caption-bold text-on-secondary-fixed">
                      02
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center text-secondary font-caption-bold text-caption-bold mb-0.5">
                        <span>Speaker B (Guest)</span>
                        <span className="font-mono">Time-Aligned</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface leading-tight">
                        Timestamps sync dialogue to clips for quick cut sheets
                        and highlights.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 flex items-center justify-between text-secondary">
                <span className="font-caption-bold text-caption-bold flex items-center gap-1.5">
                  <Icon
                    name="check_circle"
                    size={16}
                    className="text-tertiary"
                  />
                  Frame-Accurate Video Clip Cutters
                </span>
                <span className="font-mono text-[11px]">Frame-Accurate</span>
              </div>
            </div>

            {/* CARD 4 (4 Columns): Output Registry & Multi-Format Synthesis */}
            <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                    <Icon name="layers" size={20} />
                  </div>
                  <span className="font-label-caps text-label-caps text-secondary tracking-wider uppercase">
                    Polymorphic Engine
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  Native Multi-Format Synthesis
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  One source ingestion yields format-specific native deliverables
                  rather than generic truncations.
                </p>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon
                        name="article"
                        size={18}
                        className="text-primary"
                      />
                      <span className="font-body-medium text-body-medium text-on-surface">
                        Substack Deep-Dive Memo
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Editorial Long-Form
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon
                        name="share"
                        size={18}
                        className="text-primary"
                      />
                      <span className="font-body-medium text-body-medium text-on-surface">
                        LinkedIn Executive Breakdown
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Structured Carousels
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon name="tag" size={18} className="text-primary" />
                      <span className="font-body-medium text-body-medium text-on-surface">
                        X/Twitter High-Signal Threads
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Hook-to-Conclusion
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon
                        name="video_library"
                        size={18}
                        className="text-primary"
                      />
                      <span className="font-body-medium text-body-medium text-on-surface">
                        Shorts / TikTok Cut Sheets
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Kinetic Subtitles
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-2">
                <span className="font-caption-bold text-caption-bold text-tertiary flex items-center gap-1.5">
                  <Icon name="instant_mix" size={16} />
                  Simultaneous multi-channel compilation
                </span>
              </div>
            </div>

            {/* CARD 5 (4 Columns): Deterministic Dispatch & Webhooks */}
            <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                    <Icon name="send_time_extension" size={20} />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-caps text-label-caps tracking-wider uppercase">
                    Auto Relay
                  </span>
                </div>
                <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  Deterministic Dispatch &amp; Webhooks
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Verified programmatic pipeline delivery to creator accounts
                  with scheduling fallbacks and rate-limit buffering.
                </p>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        LinkedIn Creator API
                      </span>
                    </div>
<span className="font-mono text-[11px] text-tertiary">
                       Connected • Queue Ready
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Substack CMS Webhook
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-tertiary">
                      Draft Staged
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Buffer &amp; Hootsuite Relays
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-tertiary">
                      Scheduled Dispatch
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-2">
                <span className="font-caption-bold text-caption-bold text-secondary flex items-center gap-1.5">
                  <Icon name="sync" size={16} />
                  Programmatic multi-channel dispatch
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: EDITORIAL COMPARISON MATRIX */}
      <section className="w-full py-16 px-6 lg:px-12 bg-surface-container-low">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 text-center max-w-3xl mx-auto">
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-widest block mb-2">
              Architectural Reality
            </span>
            <h2 className="font-display-2xl text-display-2xl text-on-surface mb-3">
              VervAI Engine vs. Generic Wrapper Prompts
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant">
              Why sovereign creators and high-velocity editorial desks reject
              fragile single-box chat prompts in favor of programmatic pipeline
              orchestration.
            </p>
          </div>
          {/* Comparison Grid */}
          <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="min-w-[720px]">
            <div className="grid grid-cols-12 bg-surface-container-high p-4 font-headline-sm text-headline-sm text-on-surface">
              <div className="col-span-4 lg:col-span-4">
                Operational Dimension
              </div>
              <div className="col-span-4 lg:col-span-4 text-primary flex items-center gap-2">
                <Icon name="verified" size={18} />
                VervAI Sovereign DAG
              </div>
              <div className="col-span-4 lg:col-span-4 text-secondary">
                Generic AI Wrappers (ChatGPT/Claude)
              </div>
            </div>
            {/* Row 1 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  State Machine Execution
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Memory durability &amp; checkpoints
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                  <Icon name="check" size={14} />
                  Redis Durable DAG Checkpoints
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                Stateless chat context; lossy prompt truncation on long files
              </div>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-low hover:bg-surface-container transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  Brand Voice Integrity
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Adherence to tone profiles
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold">
                  <Icon name="tune" size={14} />
                  Mathematical LoRA + Hard Negative Filters
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                Severe drift towards standard robotic jargon (&ldquo;delve&rdquo;, &ldquo;tapestry&rdquo;)
              </div>
            </div>
            {/* Row 3 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  Speaker Diarization
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Multi-guest attribution
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                  <Icon name="check" size={14} />
                  Whisper-v3 Boundary Isolation
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                Zero acoustic context; quotes attributed blindly across voices
              </div>
            </div>
            {/* Row 4 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-low hover:bg-surface-container transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  Hallucination Mitigation
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Fact anchoring to source
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                  <Icon name="verified" size={14} />
                  Automated Deterministic Quotation Validator
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                Uncontrolled synthetic fact interpolation without proof paths
              </div>
            </div>
            {/* Row 5 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  Distribution Delivery
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Multi-platform dispatch
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold">
                  <Icon name="send_time_extension" size={14} />
                  Zero-Click Native Webhooks &amp; CMS Integrations
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                Manual copy-paste workflow across five separate browser tabs
              </div>
            </div>
            {/* Row 6 */}
            <div className="grid grid-cols-12 p-4 bg-surface-container-low hover:bg-surface-container transition-colors items-center">
              <div className="col-span-4 lg:col-span-4">
                <div className="font-headline-sm text-headline-sm text-on-surface">
                  Data Sovereignty
                </div>
                <span className="font-body-sm text-body-sm text-secondary">
                  Security &amp; training isolation
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                  <Icon name="shield" size={14} />
                  Zero Data Retention (ZDR) • No Model Training
                </span>
              </div>
              <div className="col-span-4 lg:col-span-4 font-body-sm text-body-sm text-on-surface-variant">
                User inputs retained or pooled for global foundation training
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: DEPLOYMENT CALLOUT BANNER */}
      <section className="w-full py-16 px-6 lg:px-12 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-2xl bg-surface-container-lowest p-8 lg:p-14 overflow-hidden shadow-md">
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-container/10 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase block mb-3">
                  Enterprise Acceleration
                </span>
                <h2 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-4">
                  Deploy autonomous content pipelines to your team with minimal
                  setup.
                </h2>
                <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl leading-relaxed">
                  Connect your podcast feeds, Google Drive, or raw voice memo
                  drops. VervAI handles transcription, intelligence
                  decomposition, tone-fitting, and channel dispatch seamlessly.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3.5 items-stretch">
                <Link
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm hover:bg-primary transition-colors shadow-sm active:scale-[0.98]"
                  href="/sign-up"
                >
                  <span>Start Free Trial</span>
                  <Icon name="arrow_forward" size={18} />
                </Link>
                <Link
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-surface-container text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-highest transition-colors active:scale-[0.98]"
                  href="/features"
                >
                  <Icon name="terminal" size={18} />
                  <span>Read API Codex</span>
                </Link>
                <span className="text-center font-caption-bold text-caption-bold text-secondary mt-1">
                  14-Day Production Trial • No Credit Card Required
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
