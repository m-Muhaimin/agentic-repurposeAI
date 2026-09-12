"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function WorkflowsContent() {
  const [activeScenario, setActiveScenario] = useState(1);

  return (
    <div className="pt-14">
      <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-16 overflow-hidden">
        <div className="absolute -top-24 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-80 h-80 bg-tertiary-fixed/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-caption-bold text-caption-bold mb-6 shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-primary-container animate-pulse" />
            <span>Autonomous Operating Protocol • End-to-End Walkthrough</span>
          </div>
          <h1 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-4">
            From Unstructured Thought to Broadcast-Ready Sovereign Assets in 3 Acts
          </h1>
          <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl mx-auto mb-10">
            A transparent, deterministic workflow engineered to eliminate prompt fatigue, preserve authentic executive voice, and automate multi-channel sovereign distribution.
          </p>
          <div className="w-full bg-surface-container-low p-2 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-2">
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm transition-all hover:bg-surface-bright group text-left" href="#act-01">
              <div className="w-7 h-7 rounded-md bg-primary-container text-on-primary flex items-center justify-center font-headline-sm text-headline-sm shrink-0">1</div>
              <div className="min-w-0">
                <span className="block font-caption-bold text-caption-bold uppercase tracking-wider text-secondary">Act 01</span>
                <span className="block font-body-medium text-body-medium truncate font-semibold">Zero-Config Intake</span>
              </div>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm transition-all hover:bg-surface-bright group text-left" href="#act-02">
              <div className="w-7 h-7 rounded-md bg-surface-container-highest text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary flex items-center justify-center font-headline-sm text-headline-sm shrink-0 transition-colors">2</div>
              <div className="min-w-0">
                <span className="block font-caption-bold text-caption-bold uppercase tracking-wider text-secondary">Act 02</span>
                <span className="block font-body-medium text-body-medium truncate font-semibold">Agent Synthesis</span>
              </div>
            </Link>
            <Link className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-lowest text-on-surface shadow-sm transition-all hover:bg-surface-bright group text-left" href="#act-03">
              <div className="w-7 h-7 rounded-md bg-surface-container-highest text-on-surface-variant group-hover:bg-primary-container group-hover:text-on-primary flex items-center justify-center font-headline-sm text-headline-sm shrink-0 transition-colors">3</div>
              <div className="min-w-0">
                <span className="block font-caption-bold text-caption-bold uppercase tracking-wider text-secondary">Act 03</span>
                <span className="block font-body-medium text-body-medium truncate font-semibold">Sign-off &amp; Dispatch</span>
              </div>
            </Link>
          </div>
        </div>
        <div className="space-y-16">
          <div className="bg-surface-container-lowest rounded-xl p-6 lg:p-10 shadow-sm" id="act-01">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-secondary-container text-on-secondary-fixed font-caption-bold text-caption-bold tracking-wider uppercase">
                  Phase Alpha • Ingestion Engine
                </div>
                <h2 className="font-display-xl text-display-xl text-on-surface">Act 01: Zero-Config Multimodal Intake</h2>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  Dump unformatted thinking directly into the hopper. VervAI accepts unstructured voice memos, raw Zoom cloud records, YouTube lectures, Loom snippets, or disjointed Markdown notes.
                </p>
                <div className="space-y-2 pt-2">
                  <div className="flex items-start gap-3">
                    <Icon name="graphic_eq" size={20} className="text-primary-container mt-0.5" />
                    <p className="font-body-sm text-body-sm text-on-surface"><span className="font-semibold">Whisper-v3 Native Diarization:</span> Auto-isolates speakers and removes filler cadence without system prompts.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon name="layers" size={20} className="text-primary-container mt-0.5" />
                    <p className="font-body-sm text-body-sm text-on-surface"><span className="font-semibold">Context Scrubbing:</span> Removes vocal ticks, audio artifacts, and transcribes technical jargon accurately.</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 bg-surface-container rounded-xl p-6 shadow-inner space-y-4">
                <div className="flex items-center justify-between pb-3 bg-surface-container">
                  <span className="font-caption-bold text-caption-bold uppercase text-secondary tracking-wider">Ingestion Workspace</span>
                  <span className="inline-flex items-center gap-1.5 font-caption-bold text-caption-bold text-tertiary bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" /> Add Source
                  </span>
                </div>
                <div className="bg-surface-container-lowest p-8 rounded-lg shadow-sm text-center flex flex-col items-center justify-center space-y-3 cursor-pointer hover:bg-surface-bright transition-colors">
                  <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container">
                    <Icon name="cloud_upload" size={28} />
                  </div>
                  <div>
                    <p className="font-headline-sm text-headline-sm text-on-surface">Drop audio, video, or doc links</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">MP3, WAV, M4A, MP4, Loom URL, YouTube URL, MD</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-2">
                    <span className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant rounded-full font-caption-bold text-caption-bold">Voice Memo (iOS/Android)</span>
                    <span className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant rounded-full font-caption-bold text-caption-bold">Zoom Cloud Webhook</span>
                    <span className="px-2.5 py-1 bg-surface-container-low text-on-surface-variant rounded-full font-caption-bold text-caption-bold">Loom ID</span>
                  </div>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="mic" size={20} className="text-secondary" />
                      <span className="font-body-medium text-body-medium text-on-surface font-semibold">founder-memo-q4-strategy.m4a</span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary">Voice or Video Source</span>
                  </div>
                  <div className="flex items-center justify-between font-caption-bold text-caption-bold text-on-surface-variant">
                    <span>Whisper-v3 Diarization</span>
                    <span>Multi-Speaker</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-6 lg:p-10 shadow-sm" id="act-02">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 order-2 lg:order-1 bg-surface-container rounded-xl p-6 shadow-inner space-y-4">
                <div className="flex items-center justify-between pb-3 bg-surface-container">
                  <span className="font-caption-bold text-caption-bold uppercase text-secondary tracking-wider">Orthogonal Multi-Agent Topology</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-caption-bold text-caption-bold bg-primary-fixed text-on-primary-fixed">
                    Agent Quorum
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-caption-bold text-caption-bold text-primary-container uppercase">Agent 01</span>
                      <span className="w-2 h-2 rounded-full bg-primary-container" />
                    </div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface">The Dialectician</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Identifies counter-intuitive assertions, steel-mans opposing market narratives, and isolates contrarian hooks.</p>
                    <div className="pt-2 text-primary font-caption-bold text-caption-bold flex items-center gap-1">
                      <span>Hooks & Counterpoints</span>
                      <Icon name="verified" size={14} />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-caption-bold text-caption-bold text-primary-container uppercase">Agent 02</span>
                      <span className="w-2 h-2 rounded-full bg-primary-container" />
                    </div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface">Framework Synthesizer</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Extracts atomic execution steps, generates conceptual diagrams, and models operational playbooks.</p>
                    <div className="pt-2 text-primary font-caption-bold text-caption-bold flex items-center gap-1">
                      <span>Playbooks & Diagrams</span>
                      <Icon name="verified" size={14} />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-caption-bold text-caption-bold text-primary-container uppercase">Agent 03</span>
                      <span className="w-2 h-2 rounded-full bg-primary-container" />
                    </div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface">Cadence Architect</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Lints rhythm, enforces variable sentence length, and applies your sovereign brand voice corpus vector weights.</p>
                    <div className="pt-2 text-primary font-caption-bold text-caption-bold flex items-center gap-1">
                      <span>Rhythm & Voice Lint</span>
                      <Icon name="verified" size={14} />
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-caption-bold text-caption-bold text-primary-container uppercase">Agent 04</span>
                      <span className="w-2 h-2 rounded-full bg-primary-container" />
                    </div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface">Native Platform Transmuter</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Outputs tailored formatting for LinkedIn Carousels, X threads, Substack essays, and internal changelogs.</p>
                    <div className="pt-2 text-primary font-caption-bold text-caption-bold flex items-center gap-1">
                      <span>Channel-Native Formats</span>
                      <Icon name="verified" size={14} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-secondary-container text-on-secondary-fixed font-caption-bold text-caption-bold tracking-wider uppercase">
                  Phase Beta • Collective Intelligence
                </div>
                <h2 className="font-display-xl text-display-xl text-on-surface">Act 02: Multi-Agent Synthesis &amp; Candidate Reservoir</h2>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  Instead of relying on a single prompt that averages your ideas into bland corporate consensus, VervAI dispatches a specialized quorum of sub-agents.
                </p>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  Each agent challenges the source audio from orthogonal viewpoints, surfacing tensions, distilling actionable playbooks, and drafting parallel asset candidates.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-6 lg:p-10 shadow-sm" id="act-03">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-secondary-container text-on-secondary-fixed font-caption-bold text-caption-bold tracking-wider uppercase">
                  Phase Gamma • Human Governance
                </div>
                <h2 className="font-display-xl text-display-xl text-on-surface">Act 03: Human-in-the-Loop Sign-off &amp; Sovereign Dispatch</h2>
                <p className="font-body-base text-body-base text-on-surface-variant">
                  Autonomous execution never means unchecked publication. Calibrated drafts land in an executive-ready staging terminal with negative-vocabulary verification and rhythm scores.
                </p>
                <div className="space-y-2 pt-2">
                  <div className="flex items-start gap-3">
                    <Icon name="verified_user" size={20} className="text-primary-container mt-0.5" />
                    <p className="font-body-sm text-body-sm text-on-surface"><span className="font-semibold">Linting Matrix:</span> Flags AI clichés, corporate fluff, and tone violations before human glance.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon name="send" size={20} className="text-primary-container mt-0.5" />
                    <p className="font-body-sm text-body-sm text-on-surface"><span className="font-semibold">Direct API Handshake:</span> Single-click dispatch to Buffer, LinkedIn, Substack, Slack, or GitHub CMS.</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 bg-surface-container rounded-xl p-6 shadow-inner space-y-4">
                <div className="flex items-center justify-between pb-3 bg-surface-container">
                  <span className="font-caption-bold text-caption-bold uppercase text-secondary tracking-wider">Candidate Sign-Off Rail</span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">Awaiting Your Review</span>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold">LinkedIn Architecture Post</span>
                      <span className="text-secondary font-caption-bold text-caption-bold">• Derived from your source</span>
                    </div>
                    <span className="text-tertiary font-caption-bold text-caption-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-tertiary" /> Voice-Matched
                    </span>
                  </div>
                  <div className="bg-surface-container-low p-3.5 rounded text-on-surface font-body-sm text-body-sm space-y-1.5">
                    <p className="font-semibold text-on-surface">&quot;Your draft appears here — written to match your calibrated voice.&quot;</p>
                    <p className="text-on-surface-variant">Every draft is drafted from your source material with citations you can verify before approving.</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-surface-container rounded font-caption-bold text-caption-bold text-secondary">No Banned Words</span>
                      <span className="px-2 py-1 bg-surface-container rounded font-caption-bold text-caption-bold text-secondary">Dynamic Rhythm: Varied</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="px-3 py-1.5 rounded-lg font-body-medium text-body-medium bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-colors">
                        Tweak
                      </button>
                      <button type="button" className="px-4 py-1.5 rounded-lg font-body-medium text-body-medium bg-primary-container text-on-primary hover:bg-primary transition-colors flex items-center gap-1">
                        <span>Approve &amp; Dispatch</span>
                        <Icon name="arrow_forward" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full bg-surface-container-low py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-3xl mb-12">
            <span className="font-caption-bold text-caption-bold uppercase tracking-wider text-secondary">Deterministic Architecture</span>
            <h3 className="font-display-xl text-display-xl text-on-surface mt-2 mb-4">Engineered for Sovereign Longevity</h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              VervAI is not an unpredictable chain-of-thought novelty. Every operation is orchestrated via acyclic state graphs, strictly checkpointed, and hardened for enterprise data isolation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                <Icon name="account_tree" size={24} />
              </div>
              <h4 className="font-headline-lg text-headline-lg text-on-surface">Durable State &amp; DAG Orchestration</h4>
              <p className="font-body-base text-body-base text-on-surface-variant">
                Built on deterministic graph engines inspired by LangGraph and Temporal. Every agent step is written to high-throughput Redis checkpoints and Supabase pgvector stores. If an upstream LLM times out, our worker resumes from the exact micro-state with zero token wastage or recursive hallucination loops.
              </p>
              <ul className="space-y-2 pt-2 font-body-sm text-body-sm text-on-surface-variant">
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-primary" />
                  <span>Reversible workflow steps and instant node rollbacks</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-primary" />
                  <span>Sub-second deterministic schema validation</span>
                </li>
              </ul>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed text-tertiary flex items-center justify-center">
                <Icon name="security" size={24} />
              </div>
              <h4 className="font-headline-lg text-headline-lg text-on-surface">Voice Calibration &amp; Zero-Retention Security</h4>
              <p className="font-body-base text-body-base text-on-surface-variant">
                Your intellectual capital belongs exclusively to you. VervAI operates under strict zero-data-retention agreements with downstream foundational model providers. Customer voice vectors are isolated in tenant-specific hardware keys with hardware-backed encryption.
              </p>
              <ul className="space-y-2 pt-2 font-body-sm text-body-sm text-on-surface-variant">
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-tertiary" />
                  <span>Zero model training on proprietary enterprise transcripts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" size={18} className="text-tertiary" />
                  <span>FIDO2 passkey enforcement and SOC-2 Type II posture</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-10">
          <span className="font-caption-bold text-caption-bold uppercase tracking-wider text-secondary">Scenario Walkthrough</span>
          <h3 className="font-display-xl text-display-xl text-on-surface mt-2 mb-4">Select an Ingestion Archetype</h3>
          <p className="font-body-base text-body-base text-on-surface-variant">
            See how the protocol mutates inputs based on source format, operational urgency, and audience vectors.
          </p>
          <div className="flex flex-wrap gap-2 p-1.5 bg-surface-container rounded-xl mt-6">
            <button
              type="button"
              onClick={() => setActiveScenario(1)}
              className={`scenario-btn px-4 py-2 rounded-lg font-body-medium text-body-medium transition-all ${
                activeScenario === 1
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Founder Solo Memo (12m)
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario(2)}
              className={`scenario-btn px-4 py-2 rounded-lg font-body-medium text-body-medium transition-all ${
                activeScenario === 2
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Weekly All-Hands (45m)
            </button>
            <button
              type="button"
              onClick={() => setActiveScenario(3)}
              className={`scenario-btn px-4 py-2 rounded-lg font-body-medium text-body-medium transition-all ${
                activeScenario === 3
                  ? "bg-surface-container-lowest text-on-surface shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Executive Podcast (60m)
            </button>
          </div>
        </div>
        <div className={`scenario-panel ${activeScenario === 1 ? "" : "hidden"} bg-surface-container-lowest rounded-xl p-8 shadow-sm`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Input Stream</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">12-Minute Raw Voice Note</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Recorded while walking. Contains stream-of-consciousness reflections on API pricing changes, background wind noise, and conversational digressions.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-secondary flex items-center gap-2">
                <Icon name="mic" size={18} /> 12m 44s • AAC Audio File
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Synthesis Matrix</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Agent Extraction Vectors</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Isolates pricing thesis points, surfaces a cost-comparison angle, and identifies a contrarian title hook.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-primary flex items-center gap-2">
                <Icon name="insights" size={18} /> Candidate Variants Compiled
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Generated Asset Pack</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Ready For Dispatch</h4>
              <ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
                <li className="flex items-center gap-2">
                  <Icon name="article" size={18} className="text-tertiary" /> Deep-Dive Substack Essay
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="share" size={18} className="text-tertiary" /> Punchy LinkedIn Thought-Lead Post
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="videocam" size={18} className="text-tertiary" /> Script Outlines for YouTube Shorts
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className={`scenario-panel ${activeScenario === 2 ? "" : "hidden"} bg-surface-container-lowest rounded-xl p-8 shadow-sm`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Input Stream</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">45-Minute Zoom All-Hands</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Multi-speaker video meeting covering product velocity, bug triaging updates, and roadmap realignment with Q&amp;A interruptions.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-secondary flex items-center gap-2">
                <Icon name="video_camera_front" size={18} /> 45m 12s • Cloud MP4 Webhook
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Synthesis Matrix</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Agent Extraction Vectors</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Diarizes every speaker, segments team commitments from high-level vision, and extracts unblocked release milestones.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-primary flex items-center gap-2">
                <Icon name="hub" size={18} /> All Speakers Resolved
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Generated Asset Pack</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Ready For Dispatch</h4>
              <ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
                <li className="flex items-center gap-2">
                  <Icon name="mark_email_read" size={18} className="text-tertiary" /> Internal Executive Memo (Slack / Notion)
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="code" size={18} className="text-tertiary" /> Public Engineering Changelog Post
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="public" size={18} className="text-tertiary" /> Culture / Milestone Post for LinkedIn
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className={`scenario-panel ${activeScenario === 3 ? "" : "hidden"} bg-surface-container-lowest rounded-xl p-8 shadow-sm`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Input Stream</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">60-Minute Podcast Interview</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Long-form discussion with an industry peer dissecting sovereign infrastructure, distributed AI agents, and market dynamics.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-secondary flex items-center gap-2">
                <Icon name="podcasts" size={18} /> 60m 05s • High-Fidelity Studio Audio
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Synthesis Matrix</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Agent Extraction Vectors</h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Maps conversational pivots into core themes, builds narrative timelines, and flags timestamped highlight clips.</p>
              <div className="p-3 bg-surface-container-low rounded-lg font-caption-bold text-caption-bold text-primary flex items-center gap-2">
                <Icon name="auto_awesome" size={18} /> Full Broadcast Blueprint Built
              </div>
            </div>
            <div className="space-y-3">
              <span className="font-caption-bold text-caption-bold uppercase text-secondary">Generated Asset Pack</span>
              <h4 className="font-headline-md text-headline-md text-on-surface">Ready For Dispatch</h4>
              <ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
                <li className="flex items-center gap-2">
                  <Icon name="newspaper" size={18} className="text-tertiary" /> Comprehensive Show-Notes Edition
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="dynamic_feed" size={18} className="text-tertiary" /> Comprehensive X / Twitter Thread
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="view_carousel" size={18} className="text-tertiary" /> PDF Carousel Slides for Executive Feeds
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full max-w-7xl mx-auto px-6 lg:px-12 pb-24">
        <div className="bg-primary text-on-primary rounded-xl p-8 lg:p-12 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-3 max-w-xl relative z-10">
            <span className="font-caption-bold text-caption-bold text-primary-fixed uppercase tracking-wider">Zero Commitment Ingestion</span>
            <h3 className="font-display-xl text-display-xl tracking-tight text-on-primary">See the protocol live in action. Try your first source free.</h3>
            <p className="font-body-base text-body-base text-primary-fixed">
              Drop a voice memo or a YouTube URL. Our agent quorum returns platform-native drafts for your review.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto relative z-10">
            <Link className="w-full sm:w-auto inline-flex items-center justify-center font-body-medium text-body-medium bg-surface-container-lowest text-on-surface hover:bg-surface-bright px-6 py-3 rounded-lg transition-all active:scale-[0.98] shadow-sm font-semibold" data-path="start-free-trial" href="/sign-up">
              Upload Your First Thought
            </Link>
            <Link className="w-full sm:w-auto inline-flex items-center justify-center font-body-medium text-body-medium bg-transparent text-on-primary hover:bg-white/10 px-5 py-3 rounded-lg transition-colors font-semibold" data-path="product-architecture" href="/features">
              Read Technical Codex
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}