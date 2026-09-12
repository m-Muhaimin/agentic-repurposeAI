"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

type FilterKey = "all" | "founder" | "marketing" | "agencies" | "creators";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All Use Cases" },
  { key: "founder", label: "Venture Founders & CEOs" },
  { key: "marketing", label: "B2B Marketing & Growth Desks" },
  { key: "agencies", label: "Boutique Agencies" },
  { key: "creators", label: "Podcast & Video Creators" },
];

export default function SolutionsContent() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const isVisible = (card: FilterKey) =>
    activeFilter === "all" || activeFilter === card;

  return (
    <div className="pt-14">
      {/* Top Ambient Canvas Lighting */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-[620px] h-[340px] bg-primary-fixed-dim/40 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-20 left-10 w-[380px] h-[280px] bg-secondary-fixed/50 rounded-full blur-2xl pointer-events-none -z-10" />

        {/* Editorial Header Section */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-8">
          <div className="flex flex-col max-w-4xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary-container text-on-secondary-fixed font-caption-bold text-caption-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Operational Archetypes
              </span>
              <span className="font-caption-bold text-caption-bold text-outline">
                Autonomous Agent Workflows
              </span>
            </div>
            <h1 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-5">
              Tailored Content Workspaces for High-Leverage Teams
            </h1>
            <p className="font-body-base text-body-base text-on-surface-variant max-w-3xl leading-relaxed">
              Discover how teams use VervAI&apos;s autonomous agent graphs to
              turn executive speech into company narrative, scale their voice,
              and streamline editorial production.
            </p>
          </div>

          {/* Persona Interactive Filter Rail */}
          <div className="mt-10 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2 rounded-lg text-body-medium font-body-medium transition-all ${
                  activeFilter === key
                    ? "bg-primary-container text-on-primary shadow-sm"
                    : "bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Bento Grid Section */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* PERSONA 1: Sovereign Founder & CEO (Desktop: 7 cols) */}
            <article
              className={`md:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm p-7 flex flex-col justify-between transition-all hover:shadow-md ${
                isVisible("founder") ? "flex" : "hidden"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                      <Icon name="mic" size={20} />
                    </div>
                    <div>
                      <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block">
                        Persona Matrix 01
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        The Sovereign Founder & CEO
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface-variant font-caption-bold text-caption-bold">
                    Voice-to-Codex
                  </span>
                </div>
                <p className="font-headline-md text-headline-md text-on-surface mb-6 leading-snug">
                  Turn commute voice memos into weekly thought leadership and
                  newsletter editions.
                </p>

                {/* Metrics Strip */}
                <div className="grid grid-cols-3 gap-3 mb-6 bg-surface-container-low p-4 rounded-lg">
                  <div>
                    <span className="font-display-xl text-display-xl text-primary block tracking-tight">
                      Amplified
                    </span>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Content Output
                    </span>
                  </div>
                  <div>
                    <span className="font-display-xl text-display-xl text-tertiary block tracking-tight">
                      Voice-Locked
                    </span>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Brand Consistency
                    </span>
                  </div>
                  <div>
                    <span className="font-display-xl text-display-xl text-on-surface block tracking-tight">
                      Heavier
                    </span>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      On Review, Not Drafting
                    </span>
                  </div>
                </div>

                {/* Visual Workflow Pipeline Diagram */}
                <div className="bg-surface-container p-4 rounded-lg mb-6">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider block mb-3">
                    Execution Pipeline
                  </span>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-body-sm font-body-sm text-on-surface">
                    <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded shadow-sm">
                      <Icon
                        name="voice_selection"
                        size={18}
                        className="text-primary"
                      />
                      <span>Audio Memo (Car/Walk)</span>
                    </div>
                    <Icon
                      name="arrow_forward"
                      size={18}
                      className="text-outline rotate-90 sm:rotate-0"
                    />
                    <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded shadow-sm">
                      <Icon
                        name="neurology"
                        size={18}
                        className="text-tertiary"
                      />
                      <span>Whisper-v3 Diarization</span>
                    </div>
                    <Icon
                      name="arrow_forward"
                      size={18}
                      className="text-outline rotate-90 sm:rotate-0"
                    />
                    <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-2 rounded shadow-sm">
                      <Icon
                        name="edit_note"
                        size={18}
                        className="text-on-secondary-fixed"
                      />
                      <span>Substack Draft + Hook Variants</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verified Testimonial Footprint with Photo */}
              <div className="bg-surface-container-low p-4 rounded-lg flex items-center gap-4 mt-2">
                <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0 text-primary">
                  <Icon name="auto_awesome" size={22} />
                </div>
                <div className="min-w-0">
                  <p className="font-body-sm text-body-sm text-on-surface italic line-clamp-2">
                    Record a voice memo once. VervAI drafts the platform-native
                    pieces; you review, refine, and dispatch.
                  </p>
                  <p className="font-caption-bold text-caption-bold text-secondary mt-1">
                    Sovereign Creator Workflow
                  </p>
                </div>
              </div>
            </article>

            {/* PERSONA 2: B2B Marketing & Enterprise Media Desks (Desktop: 5 cols) */}
            <article
              className={`md:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm p-7 flex flex-col justify-between transition-all hover:shadow-md ${
                isVisible("marketing") ? "flex" : "hidden"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                      <Icon name="hub" size={20} />
                    </div>
                    <div>
                      <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block">
                        Persona Matrix 02
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        B2B Media Desks
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-tertiary-fixed/40 text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                    Multi-Seat Matrix
                  </span>
                </div>
                <p className="font-headline-md text-headline-md text-on-surface mb-4 leading-snug">
                  Turn product walkthroughs and technical whitepapers into full
                  omnichannel campaigns.
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  Empower growth desks with custom LoRA tone models per
                  executive and negative vocabulary firewalls that eradicate
                  corporate filler words.
                </p>

                {/* Metrics Twin Bar */}
                <div className="grid grid-cols-2 gap-3 mb-6 bg-surface-container-low p-4 rounded-lg">
                  <div>
                    <span className="font-display-xl text-display-xl text-primary block tracking-tight">
                      Parallel
                    </span>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Pipeline Execution
                    </span>
                  </div>
                  <div>
                    <span className="font-display-xl text-display-xl text-tertiary block tracking-tight">
                      Streamlined
                    </span>
                    <span className="font-caption-bold text-caption-bold text-secondary">
                      Review Workflow
                    </span>
                  </div>
                </div>

                {/* Feature Tags Checklist */}
                <ul className="space-y-2.5 mb-4">
                  <li className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                    <Icon
                      name="verified"
                      size={18}
                      className="text-tertiary"
                    />
                    Multi-seat permissions & review lock
                  </li>
                  <li className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                    <Icon
                      name="verified"
                      size={18}
                      className="text-tertiary"
                    />
                    Custom LoRA voice tuning per lead
                  </li>
                  <li className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface">
                    <Icon
                      name="verified"
                      size={18}
                      className="text-tertiary"
                    />
                    Real-time technical term whitelist
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="font-caption-bold text-caption-bold text-secondary">
                  Omnichannel Engine v4.8
                </span>
                <Link
                  className="inline-flex items-center gap-1 font-body-medium text-body-medium text-primary hover:underline"
                  href="/features"
                >
                  Inspect Architecture{" "}
                  <Icon name="arrow_forward" size={16} />
                </Link>
              </div>
            </article>

            {/* PERSONA 3: Executive Ghostwriters & Boutique Agencies (Desktop: 6 cols) */}
            <article
              className={`md:col-span-6 bg-surface-container-lowest rounded-xl shadow-sm p-7 flex flex-col justify-between transition-all hover:shadow-md ${
                isVisible("agencies") ? "flex" : "hidden"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
                      <Icon name="shield_person" size={20} />
                    </div>
                    <div>
                      <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block">
                        Persona Matrix 03
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Ghostwriters & Boutique Agencies
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-surface-container text-secondary font-caption-bold text-caption-bold">
                    Partition Isolation
                  </span>
                </div>
                <p className="font-headline-md text-headline-md text-on-surface mb-3 leading-snug">
                  Manage multiple client brand voices in dedicated sovereign
                  partitions without tone bleed.
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  Zero cross-pollination between portfolio accounts. Build
                  client-specific memory banks, bespoke review rooms, and
                  manifest export pipelines.
                </p>

                {/* Interactive Partition Visualizer */}
                <div className="space-y-2 mb-6">
                  <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Brand Voice Partition A
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary bg-surface-container-lowest px-2 py-0.5 rounded">
                      Isolated Memory
                    </span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Brand Voice Partition B
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary bg-surface-container-lowest px-2 py-0.5 rounded">
                      Isolated Memory
                    </span>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                      <span className="font-body-sm text-body-sm text-on-surface font-medium">
                        Brand Voice Partition C
                      </span>
                    </div>
                    <span className="font-caption-bold text-caption-bold text-secondary bg-surface-container-lowest px-2 py-0.5 rounded">
                      Isolated Memory
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container p-3.5 rounded-lg flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Partition isolation:
                </span>
                <span className="font-caption-bold text-caption-bold text-on-surface">
                  No Cross-Account Bleed
                </span>
              </div>
            </article>

            {/* PERSONA 4: Technical Podcasters & Video Shows (Desktop: 6 cols) */}
            <article
              className={`md:col-span-6 bg-surface-container-lowest rounded-xl shadow-sm p-7 flex flex-col justify-between transition-all hover:shadow-md ${
                isVisible("creators") ? "flex" : "hidden"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary-fixed-dim flex items-center justify-center text-primary">
                      <Icon name="videocam" size={20} />
                    </div>
                    <div>
                      <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block">
                        Persona Matrix 04
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Technical Podcasters & Video Shows
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-surface-container text-secondary font-caption-bold text-caption-bold">
                    Frame-Accurate
                  </span>
                </div>
                <p className="font-headline-md text-headline-md text-on-surface mb-3 leading-snug">
                  Extract frame-accurate viral micro-clips, architectural
                  diagrams, and comprehensive episode notes.
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  Sub-second audio diarization detects speaker turns, extracts
                  technical terms into GitHub Markdown summaries, and syncs
                  clips downstream.
                </p>

                {/* Media Processing Matrix Graphic */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3.5 bg-surface-container-low rounded-lg">
                    <div className="flex items-center gap-2 mb-1.5 text-primary">
                      <Icon name="subtitles" size={18} />
                      <span className="font-caption-bold text-caption-bold">
                        Sub-Second Sync
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Kinetic captions with automatic monospaced code styling.
                    </p>
                  </div>
                  <div className="p-3.5 bg-surface-container-low rounded-lg">
                    <div className="flex items-center gap-2 mb-1.5 text-tertiary">
                      <Icon name="share" size={18} />
                      <span className="font-caption-bold text-caption-bold">
                        Cross-Pipeline
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Auto-distribute to Buffer, YouTube chapters & RSS notes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-container p-3.5 rounded-lg flex items-center justify-between">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Production workflow:
                </span>
                <span className="font-caption-bold text-caption-bold text-tertiary">
                  Streamlined Per Episode
                </span>
              </div>
            </article>
          </div>
        </section>

        {/* Verified Real-World Case Studies & Empirical Metrics */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-12">
          <div className="mb-8">
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block mb-2">
              Operating Model
            </span>
            <h2 className="font-display-xl text-display-xl text-on-surface tracking-tight">
              How the Pipeline Runs
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pipeline Pattern 1: Voice & Loom Intake */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="font-headline-lg text-headline-lg text-on-surface block">
                      Voice & Loom Intake
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      From raw recordings to drafts
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-caption-bold text-caption-bold">
                    Omnichannel Drafting
                  </span>
                </div>
                <p className="font-body-base text-body-base text-on-surface-variant mb-8">
                  Typical flow: upload an executive voice memo or design
                  walkthrough. VervAI separates speakers, surfaces the strongest
                  hooks, and drafts native posts for every channel you publish
                  to.
                </p>
                <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-5 rounded-lg mb-6">
                  <div>
                    <div className="font-display-2xl text-display-2xl text-primary font-bold tracking-tight">
                      Native
                    </div>
                    <div className="font-caption-bold text-caption-bold text-secondary mt-1">
                      Per-Channel Drafting
                    </div>
                  </div>
                  <div>
                    <div className="font-display-2xl text-display-2xl text-tertiary font-bold tracking-tight">
                      Cited
                    </div>
                    <div className="font-caption-bold text-caption-bold text-secondary mt-1">
                      Source-Anchored Quotes
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="font-caption-bold text-caption-bold text-outline">
                  Documented workflow
                </span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium flex items-center gap-1">
                  See Pipeline{" "}
                  <Icon name="north_east" size={16} />
                </span>
              </div>
            </div>

            {/* Pipeline Pattern 2: Podcast & Interview Synthesis */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="font-headline-lg text-headline-lg text-on-surface block">
                      Podcast & Interview Synthesis
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Multi-guest shows into assets
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-caption-bold text-caption-bold">
                    Guest Diarization
                  </span>
                </div>
                <p className="font-body-base text-body-base text-on-surface-variant mb-8">
                  For multi-guest episodes, VervAI attributes every quote to the
                  right speaker, extracts timestamped clips, and compiles show
                  notes plus social posts in a single pass.
                </p>
                <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-5 rounded-lg mb-6">
                  <div>
                    <div className="font-display-2xl text-display-2xl text-primary font-bold tracking-tight">
                      Per-Speaker
                    </div>
                    <div className="font-caption-bold text-caption-bold text-secondary mt-1">
                      Quote Attribution
                    </div>
                  </div>
                  <div>
                    <div className="font-display-2xl text-display-2xl text-tertiary font-bold tracking-tight">
                      Anchored
                    </div>
                    <div className="font-caption-bold text-caption-bold text-secondary mt-1">
                      Timestamp-Clipped Highlights
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="font-caption-bold text-caption-bold text-outline">
                  Prompt-free operation
                </span>
                <span className="font-body-sm text-body-sm text-on-surface font-medium flex items-center gap-1">
                  See Pipeline{" "}
                  <Icon name="north_east" size={16} />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Full Editorial CTA / Conversion Module */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-6 pb-20">
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest shadow-md p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-primary-fixed/50 rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-primary-fixed text-on-primary-fixed font-caption-bold text-caption-bold mb-4">
                Custom Deployments Available
              </span>
              <h2 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-4">
                Find out how VervAI transforms your team&apos;s content
                operations.
              </h2>
              <p className="font-body-base text-body-base text-on-surface-variant">
                Schedule a private architectural walkthrough or launch an
                evaluation partition with sovereign model guardrails.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0 relative z-10">
              <Link
                className="inline-flex items-center justify-center font-body-medium text-body-medium bg-primary-container text-on-primary hover:bg-primary py-2.5 px-5 rounded-lg shadow-sm transition-all active:scale-[0.98]"
                href="/sign-up"
              >
                Start Free Trial
              </Link>
              <Link
                className="inline-flex items-center justify-center font-body-medium text-body-medium bg-surface-container text-on-surface hover:bg-surface-container-high px-6 py-3 rounded-lg transition-all"
                href="/enterprise"
              >
                Book Architecture Demo
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
