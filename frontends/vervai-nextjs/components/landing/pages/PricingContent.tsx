"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

type BillingMode = "monthly" | "annual";

export default function PricingContent() {
  const [billing, setBilling] = useState<BillingMode>("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(1);

  const isAnnual = billing === "annual";

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  return (
    <div className="pt-14">
      {/* Section 1: Editorial Header & Billing Toggle */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-14 w-full">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-surface-container text-tertiary font-caption-bold text-caption-bold tracking-wide">
                SOVEREIGN ARCHITECTURE PRICING
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
              <span className="font-caption-bold text-caption-bold text-secondary">
                ZERO TELEMETRY LEAKAGE
              </span>
            </div>
            <h1 className="font-display-2xl text-display-2xl text-on-surface tracking-tight mb-4">
              Predictable Capacity. Sovereign Infrastructure. Zero Hidden Usage
              Fees.
            </h1>
            <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl">
              Start free with 20 synthesis credits. Scale effortlessly as your
              multi-agent pipelines and distribution relays grow without model
              vendor lock-in.
            </p>
          </div>

          {/* Plan Switcher */}
          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="inline-flex p-1 rounded-lg bg-surface-container-high shadow-inner">
              <button
                onClick={() => setBilling("monthly")}
                className={
                  !isAnnual
                    ? "px-4 py-2 rounded-md font-body-medium text-body-medium bg-surface-container-lowest text-primary shadow-sm transition-all"
                    : "px-4 py-2 rounded-md font-body-medium text-body-medium text-on-surface-variant hover:text-on-surface transition-all"
                }
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={
                  isAnnual
                    ? "px-4 py-2 rounded-md font-body-medium text-body-medium bg-surface-container-lowest text-primary shadow-sm transition-all flex items-center gap-2"
                    : "px-4 py-2 rounded-md font-body-medium text-body-medium text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2"
                }
              >
                <span>Annual Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-caption-bold">
                  Save 20% + 2 Mo Free
                </span>
              </button>
            </div>
            <span className="font-caption-bold text-caption-bold text-secondary">
              Prices listed in USD • Invoices include VAT calculation
            </span>
          </div>
        </div>

        {/* Trust Strip Pill Banner */}
        <div className="w-full bg-surface-container-low rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-on-surface">
              <Icon name="verified_user" size={18} className="text-primary" />
              <span className="font-body-sm text-body-sm font-medium">
                14-Day Free Trial
              </span>
            </div>
            <div className="flex items-center gap-2 text-on-surface">
              <Icon
                name="credit_card_off"
                size={18}
                className="text-primary"
              />
              <span className="font-body-sm text-body-sm font-medium">
                No Credit Card Required
              </span>
            </div>
            <div className="flex items-center gap-2 text-on-surface">
              <Icon name="lock" size={18} className="text-primary" />
              <span className="font-body-sm text-body-sm font-medium">
                Zero Model-Training Clause (SOC2 Type II)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-caption-bold text-caption-bold text-on-surface-variant">
              Sovereign Isolation
            </span>
            <span className="inline-flex w-2.5 h-2.5 rounded-full bg-tertiary" />
            <span className="font-caption-bold text-caption-bold text-tertiary">
              Deterministic
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Core Subscription Bento Cards */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* Tier 1: Starter Creator (Col 4) */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                  Independent Core
                </span>
                <span className="px-2.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-caption-bold text-caption-bold">
                  Starter Creator
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 min-h-[36px]">
                Engineered for solo founders, boutique authors, and independent
                media strategists.
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display-2xl text-display-2xl text-on-surface font-bold">
                  {isAnnual ? "$39" : "$49"}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {isAnnual
                    ? "/mo (billed annually)"
                    : "/mo (billed monthly)"}
                </span>
              </div>
              <p className="font-caption-bold text-caption-bold text-secondary mb-8">
                Includes 20 synthesis runs included every 30 days
              </p>
              <div className="w-full h-px bg-surface-container-highest mb-6" />
              <div className="space-y-4 mb-8">
                <span className="block font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                  What&apos;s Provisioned
                </span>
                <ul className="space-y-3 font-body-sm text-body-sm text-on-surface">
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="check_circle"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>20 Audio/Video syntheses</strong> per billing
                      cycle
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="check_circle"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>1 Core Brand Voice</strong> semantic matrix
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="check_circle"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      Negative Vocabulary Gate (up to 25 banned phrases)
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="check_circle"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>Whisper-v3 standard diarization channel</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="check_circle"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      LinkedIn &amp; Substack automated export webhooks
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 text-on-surface-variant">
                    <Icon
                      name="remove"
                      size={18}
                      className="text-outline-variant shrink-0 mt-0.5"
                    />
                    <span>Single seat workspace</span>
                  </li>
                </ul>
              </div>
            </div>
            <Link
              href="/sign-up"
              className="w-full text-center py-2.5 px-4 rounded-lg bg-surface-container-high text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-highest transition-colors block"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Tier 2: Studio Pro (Col 4 - FEATURED) */}
          <div className="lg:col-span-4 bg-primary text-on-primary rounded-xl p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
            {/* Accent Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-primary-container/40 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="font-label-caps text-label-caps uppercase text-primary-fixed tracking-wider">
                  Most Selected Architecture
                </span>
                <span className="px-2.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-caption-bold">
                  Production Desk
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-primary-fixed mb-6 min-h-[36px]">
                For high-throughput venture brands, podcast teams, and executive
                communications suites.
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display-2xl text-display-2xl text-on-primary font-bold">
                  {isAnnual ? "$119" : "$149"}
                </span>
                <span className="font-body-sm text-body-sm text-primary-fixed">
                  {isAnnual
                    ? "/mo (billed annually)"
                    : "/mo (billed monthly)"}
                </span>
              </div>
              <p className="font-caption-bold text-caption-bold text-primary-fixed mb-8">
                Unlimited source intake + high-priority GPU batching
              </p>
              <div className="w-full h-px bg-primary-container mb-6" />
              <div className="space-y-4 mb-8">
                <span className="block font-label-caps text-label-caps uppercase text-primary-fixed tracking-wider">
                  Engineered Features
                </span>
                <ul className="space-y-3 font-body-sm text-body-sm text-on-primary">
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="verified"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>Unlimited source intake</strong> (WAV, MP4,
                      YouTube, PDF)
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="group"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>3 Active Creator Seats</strong> with concurrent
                      sessions
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="tune"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>5 Brand Timbre LoRA Calibrations</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="database"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      Dedicated pgvector memory isolation partition
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="speed"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      Priority Whisper-v3 GPU runtime
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="share"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      Native Buffer, LinkedIn, Substack, &amp; X Relays
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="rule"
                      size={18}
                      className="text-tertiary-fixed shrink-0 mt-0.5"
                    />
                    <span>
                      Multi-user Human-in-the-Loop review queue
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="relative z-10">
              <Link
                href="/sign-up"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-surface-container-lowest text-primary font-headline-sm text-headline-sm hover:bg-surface-container-low transition-colors shadow-md"
              >
                <span>Start 14-Day Free Trial</span>
                <Icon name="arrow_forward" size={18} />
              </Link>
              <p className="font-caption-bold text-caption-bold text-primary-fixed text-center mt-3">
                Full Studio access enabled instantly
              </p>
            </div>
          </div>

          {/* Tier 3: Enterprise Codex (Col 4) */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                  Bespoke SLA
                </span>
                <span className="px-2.5 py-0.5 rounded bg-surface-container text-on-surface font-caption-bold text-caption-bold">
                  Enterprise Codex
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 min-h-[36px]">
                Tailored for media networks, venture firms, and global teams
                with strict data sovereignty mandates.
              </p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-display-2xl text-display-2xl text-on-surface font-bold">
                  Custom
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  / SLA tailored contract
                </span>
              </div>
              <p className="font-caption-bold text-caption-bold text-secondary mb-8">
                Dedicated tenancy &amp; sovereign infrastructure deployment
              </p>
              <div className="w-full h-px bg-surface-container-highest mb-6" />
              <div className="space-y-4 mb-8">
                <span className="block font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                  Enterprise Inclusions
                </span>
                <ul className="space-y-3 font-body-sm text-body-sm text-on-surface">
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="verified_user"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      <strong>Dedicated single-tenant infrastructure</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="dns"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      Private VPC or on-premise model weights deployment
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="integration_instructions"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      Custom Headless API &amp; proprietary CMS bridges
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="vpn_key"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      FIDO2 / SSO SAML authentication &amp; SCIM user
                      provisioning
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="shield"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      SOC-2 Type II audit trail exports
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Icon
                      name="support_agent"
                      size={18}
                      className="text-primary shrink-0 mt-0.5"
                    />
                    <span>
                      Dedicated Solutions Engineer desk &amp; 1-hour P1 SLA
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <Link
              href="/enterprise"
              className="w-full text-center py-3 px-4 rounded-lg bg-surface-container-highest text-on-surface font-headline-sm text-headline-sm hover:bg-surface-dim transition-colors block"
            >
              Contact Solutions Desk
            </Link>
          </div>
        </div>
      </section>

      {/* Section 3: On-Demand Capacity Top-Up Packs */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16 w-full">
        <div className="bg-surface-container-low rounded-xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                No Expiring Lock-In
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                On-Demand Capacity Top-Up Packs
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
              Purchased credits stay in your workspace indefinitely. They only
              trigger when your monthly allocation is fully consumed.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Top-up 1 */}
            <div className="bg-surface-container-lowest rounded-lg p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    +10 Synthesis Credits
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container font-caption-bold text-caption-bold text-secondary">
                    Instant
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Add 10 high-resolution multimodal transformations. Ideal for
                  episodic podcast bursts.
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-surface-container-highest">
                <div>
                  <span className="font-display-xl text-display-xl text-on-surface font-bold">
                    $49
                  </span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    {" "}
                    one-time
                  </span>
                </div>
                <Link
                  href="/sign-up"
                  className="px-3.5 py-1.5 rounded-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-body-medium text-body-medium transition-colors"
                >
                  Add Pack
                </Link>
              </div>
            </div>

            {/* Top-up 2 (Featured) */}
            <div className="bg-surface-container-lowest rounded-lg p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-tertiary-fixed text-on-tertiary-fixed px-3 py-0.5 rounded-bl-lg font-caption-bold text-caption-bold">
                Best Value
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    +25 Synthesis Credits
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Expand capacity with 25 runs and priority parallel model
                  dispatch.
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-surface-container-highest">
                <div>
                  <span className="font-display-xl text-display-xl text-primary font-bold">
                    $99
                  </span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    {" "}
                    one-time
                  </span>
                </div>
                <Link
                  href="/sign-up"
                  className="px-3.5 py-1.5 rounded-md bg-primary text-on-primary hover:bg-primary-container font-body-medium text-body-medium transition-colors shadow-sm"
                >
                  Add Pack
                </Link>
              </div>
            </div>

            {/* Top-up 3 */}
            <div className="bg-surface-container-lowest rounded-lg p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    +10 Hours Ingestion
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container font-caption-bold text-caption-bold text-secondary">
                    Audio / Video
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Buffer Whisper-v3 transcription capacity for raw recordings
                  and long-form panels.
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-surface-container-highest">
                <div>
                  <span className="font-display-xl text-display-xl text-on-surface font-bold">
                    $39
                  </span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    {" "}
                    one-time
                  </span>
                </div>
                <Link
                  href="/sign-up"
                  className="px-3.5 py-1.5 rounded-md bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-body-medium text-body-medium transition-colors"
                >
                  Add Pack
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Architecture & Runtime Guarantees */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Architectural Explainer Bento (Col 7) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-8 shadow-sm flex flex-col justify-between">
            <div>
              <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider mb-2 block">
                Infrastructure Guarantees
              </span>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-3">
                Deterministic Output, Air-Gapped Privacy
              </h3>
              <p className="font-body-base text-body-base text-on-surface-variant mb-6">
                Unlike commoditized generative wrappers, VervAI allocates
                dedicated vector embeddings and runtime containers. Your
                proprietary executive memos, customer interviews, and brand
                strategies are never passed to public LLM reinforcement
                pipelines.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-surface-container p-4 rounded-lg">
                  <Icon
                    name="memory"
                    size={20}
                    className="text-primary mb-2"
                  />
                  <p className="font-caption-bold text-caption-bold text-on-surface">
                    Zero Data Retention
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Transcripts auto-purge after vectorization
                  </p>
                </div>
                <div className="bg-surface-container p-4 rounded-lg">
                  <Icon
                    name="speed"
                    size={20}
                    className="text-tertiary mb-2"
                  />
                  <p className="font-caption-bold text-caption-bold text-on-surface">
                    Low Latency Queues
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Responsive turnaround for long-form streams
                  </p>
                </div>
                <div className="bg-surface-container p-4 rounded-lg">
                  <Icon
                    name="shield_lock"
                    size={20}
                    className="text-secondary mb-2"
                  />
                  <p className="font-caption-bold text-caption-bold text-on-surface">
                    SOC2 Isolation
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Sovereign pgvector encryption at rest
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-surface-container-highest">
              <span className="font-body-sm text-body-sm text-secondary">
                Audit compliance verified monthly
              </span>
              <Link
                href="/enterprise"
                className="font-body-medium text-body-medium text-primary hover:underline flex items-center gap-1"
              >
                <span>Read Trust Dossier</span>
                <Icon name="open_in_new" size={16} />
              </Link>
            </div>
          </div>

          {/* Runtime Guarantees Bento (Col 5) */}
          <div className="lg:col-span-5 bg-surface-container rounded-xl p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">
                  Runtime Architecture
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-caption-bold text-caption-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />{" "}
                  Deterministic
                </span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-2">
                How Workloads Are Processed
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                Every synthesis runs through a checkpointed pipeline with
                per-tenant isolation. No shared inference memory between
                workspaces.
              </p>

              {/* Runtime Guarantees */}
              <div className="bg-surface-container-lowest p-4 rounded-lg mb-6 shadow-inner space-y-3">
                <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                  <span className="font-caption-bold text-caption-bold text-on-surface">
                    Isolation
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Dedicated per-workspace context
                  </span>
                </div>
                <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                  <span className="font-caption-bold text-caption-bold text-on-surface">
                    Dispatch
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Low-latency worker queues
                  </span>
                </div>
                <div className="flex items-center justify-between bg-surface-container p-3 rounded-lg">
                  <span className="font-caption-bold text-caption-bold text-on-surface">
                    Checkpoints
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Persistent, resumable runs
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Icon
                name="terminal"
                size={20}
                className="text-secondary"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono text-xs">
                Data encrypted at rest and in transit
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Comprehensive Feature Comparison Table */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-20 w-full">
        <div className="mb-8">
          <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block mb-2">
            Deterministic Specifications
          </span>
          <h2 className="font-display-xl text-display-xl text-on-surface">
            Compare vervAI Capabilities
          </h2>
          <p className="font-body-base text-body-base text-on-surface-variant mt-1">
            Deep inspection across ingestion pipelines, LoRA tuning, and
            enterprise relays.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-container-highest">
                  <th className="p-5 font-headline-sm text-headline-sm text-on-surface w-2/5">
                    Platform Capabilities
                  </th>
                  <th className="p-5 font-headline-sm text-headline-sm text-on-surface w-1/5">
                    Starter Creator
                  </th>
                  <th className="p-5 font-headline-sm text-headline-sm text-primary w-1/5 bg-primary/5">
                    Studio Pro
                  </th>
                  <th className="p-5 font-headline-sm text-headline-sm text-on-surface w-1/5">
                    Enterprise Codex
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-highest font-body-sm text-body-sm">
                {/* Category: Ingestion & Diarization */}
                <tr className="bg-surface-container-high/40">
                  <td
                    className="px-5 py-2.5 font-label-caps text-label-caps uppercase text-secondary tracking-wider"
                    colSpan={4}
                  >
                    Ingestion &amp; Diarization
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Monthly Ingestion Limit
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    20 Syntheses / mo
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Unlimited Audio/Video Ingest
                  </td>
                  <td className="p-5 text-on-surface">
                    Uncapped Dedicated Cluster
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Diarization Engine
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Whisper-v3 Standard
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Whisper-v3 Accelerated GPU Queue
                  </td>
                  <td className="p-5 text-on-surface">
                    Private Fine-Tuned Whisper In-VPC
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Raw Source Input Types
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    MP3, WAV, YouTube, Substack
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    All formats + Zoom/Meet auto-sync
                  </td>
                  <td className="p-5 text-on-surface">
                    Custom S3 / Webhook Ingestion API
                  </td>
                </tr>

                {/* Category: Multi-Agent Intelligence & Timbre */}
                <tr className="bg-surface-container-high/40">
                  <td
                    className="px-5 py-2.5 font-label-caps text-label-caps uppercase text-secondary tracking-wider"
                    colSpan={4}
                  >
                    Multi-Agent Intelligence &amp; Brand Timbre
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Brand Voice Matrices
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    1 Core Matrix
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    5 Brand Timbre LoRA Calibrations
                  </td>
                  <td className="p-5 text-on-surface">
                    Unlimited Custom Matrix Partitions
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Negative Vocabulary Filter
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Up to 25 Terms
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Unlimited Regex &amp; Semantic Ban List
                  </td>
                  <td className="p-5 text-on-surface">
                    Custom LLM Policy Classifier Guardrails
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    pgvector Memory Partition
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Shared Multi-Tenant
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Dedicated Isolated Partition
                  </td>
                  <td className="p-5 text-on-surface">
                    Air-Gapped Sovereign Vector DB
                  </td>
                </tr>

                {/* Category: Distribution Relays & Team */}
                <tr className="bg-surface-container-high/40">
                  <td
                    className="px-5 py-2.5 font-label-caps text-label-caps uppercase text-secondary tracking-wider"
                    colSpan={4}
                  >
                    Distribution Relays &amp; Team Collaboration
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Seat Inclusions
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    1 Solo User
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    3 Active Collaborative Seats
                  </td>
                  <td className="p-5 text-on-surface">
                    Custom Seats + Multi-Org SCIM
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Connected Distribution Relays
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    LinkedIn &amp; Substack Webhooks
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Buffer, LinkedIn, Substack, &amp; X
                  </td>
                  <td className="p-5 text-on-surface">
                    Headless CMS, Slack Bot, Ghost, &amp; Custom
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Review Flow
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Single-step Draft
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Multi-User Human-in-the-Loop Review
                  </td>
                  <td className="p-5 text-on-surface">
                    Configurable Multi-Tier Editorial Approval
                  </td>
                </tr>

                {/* Category: Security & Compliance */}
                <tr className="bg-surface-container-high/40">
                  <td
                    className="px-5 py-2.5 font-label-caps text-label-caps uppercase text-secondary tracking-wider"
                    colSpan={4}
                  >
                    Security &amp; Governance
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Zero Model Training Guarantee
                  </td>
                  <td className="p-5 text-tertiary font-medium">
                    Guaranteed
                  </td>
                  <td className="p-5 text-tertiary font-medium bg-primary/5">
                    Guaranteed
                  </td>
                  <td className="p-5 text-tertiary font-medium">
                    Sovereign SLA Backed
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Authentication Options
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Magic Link &amp; Google SSO
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    2FA &amp; Role-Based Access Control
                  </td>
                  <td className="p-5 text-on-surface">
                    FIDO2, Okta, Azure AD SAML 2.0
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/50">
                  <td className="p-5 text-on-surface font-medium">
                    Support SLA
                  </td>
                  <td className="p-5 text-on-surface-variant">
                    Standard Email (24h)
                  </td>
                  <td className="p-5 text-on-surface font-medium bg-primary/5">
                    Priority Private Channel (4h)
                  </td>
                  <td className="p-5 text-on-surface">
                    Dedicated Solutions Desk (1h P1)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 6: Frequently Asked Questions */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-20 w-full">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* FAQ Left Header */}
          <div className="lg:w-1/3">
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider block mb-2">
              Clarifications &amp; Architecture
            </span>
            <h2 className="font-display-xl text-display-xl text-on-surface mb-4">
              Frequently Answered Queries
            </h2>
            <p className="font-body-base text-body-base text-on-surface-variant mb-6">
              Everything you need to know about our sovereign computing model,
              capacity tokens, and enterprise-grade data boundaries.
            </p>
            <div className="bg-surface-container-low p-5 rounded-lg">
              <p className="font-caption-bold text-caption-bold text-on-surface mb-1">
                Need a custom contract or HIPAA BAA?
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
                Our legal engineering team reviews custom MSAs within 48 business
                hours.
              </p>
              <Link
                href="/enterprise"
                className="inline-flex items-center gap-1 font-body-medium text-body-medium text-primary hover:underline"
              >
                <span>Speak with Governance Lead</span>
                <Icon name="arrow_right_alt" size={16} />
              </Link>
            </div>
          </div>

          {/* FAQ Accordion (Right) */}
          <div className="lg:w-2/3 space-y-4">
            {/* FAQ Item 1 */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => toggleFaq(1)}
              >
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  How do synthesis credits work?
                </span>
                <Icon
                  name={openFaq === 1 ? "remove" : "add"}
                  size={20}
                  className="text-secondary shrink-0"
                />
              </button>
              {openFaq === 1 && (
                <div className="pt-4 text-on-surface-variant font-body-base text-body-base">
                  A synthesis credit triggers a full autonomous extraction
                  cycle: transcribing, speaker-attribution diarization, semantic
                  vector indexing, brand voice calibration, and multiformat
                  drafting (e.g. executive newsletters, distilled long-form
                  threads, and cross-platform briefs). Short-form clips or
                  micro-revisions inside the Human-in-the-Loop review editor
                  never consume additional credits.
                </div>
              )}
            </div>

            {/* FAQ Item 2 */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => toggleFaq(2)}
              >
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Are my inputs or transcripts used to train public AI models?
                </span>
                <Icon
                  name={openFaq === 2 ? "remove" : "add"}
                  size={20}
                  className="text-secondary shrink-0"
                />
              </button>
              {openFaq === 2 && (
                <div className="pt-4 text-on-surface-variant font-body-base text-body-base">
                  <strong>Never.</strong> We maintain a strict zero-retention
                  guarantee verified by our SOC-2 Type II controls. Raw audio,
                  video, transcripts, and custom brand rubrics are isolated in
                  ephemeral GPU environments or sovereign pgvector instances. No
                  public model weights (OpenAI, Anthropic, or open weights) are
                  allowed to train or adapt on user-submitted data.
                </div>
              )}
            </div>

            {/* FAQ Item 3 */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => toggleFaq(3)}
              >
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Can I connect multiple social accounts and team workspaces?
                </span>
                <Icon
                  name={openFaq === 3 ? "remove" : "add"}
                  size={20}
                  className="text-secondary shrink-0"
                />
              </button>
              {openFaq === 3 && (
                <div className="pt-4 text-on-surface-variant font-body-base text-body-base">
                  Yes. The Studio Pro tier includes 3 collaborative creator
                  seats with independent social integration relays (LinkedIn
                  personal &amp; company pages, Substack publications, X/Twitter,
                  Buffer). Enterprise Codex plans support granular organization
                  structures with unlimited sub-brands and team divisions.
                </div>
              )}
            </div>

            {/* FAQ Item 4 */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <button
                className="w-full flex items-center justify-between gap-4 text-left"
                onClick={() => toggleFaq(4)}
              >
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  What happens if I exceed my monthly allocation?
                </span>
                <Icon
                  name={openFaq === 4 ? "remove" : "add"}
                  size={20}
                  className="text-secondary shrink-0"
                />
              </button>
              {openFaq === 4 && (
                <div className="pt-4 text-on-surface-variant font-body-base text-body-base">
                  We never throttle your production pipelines or slap surprising
                  overage fees on your account. When your threshold is reached,
                  your workflow pauses cleanly and prompts you to either activate
                  an On-Demand Top-Up Pack or wait for your cycle renewal. Top-Up
                  packs never expire and roll over indefinitely.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: Closing Callout Banner */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24 w-full">
        <div className="bg-surface-container-lowest rounded-2xl p-10 md:p-14 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 border-l-4 border-l-primary">
          <div className="max-w-2xl">
            <span className="font-label-caps text-label-caps uppercase text-tertiary tracking-wider block mb-2 font-bold">
              SOVEREIGN WORKSPACE ADOPTION
            </span>
            <h3 className="font-display-2xl text-display-2xl text-on-surface mb-3">
              Build sovereign content pipelines with VervAI.
            </h3>
            <p className="font-body-base text-body-base text-on-surface-variant">
              Deploy deterministic pipelines that distill high-signal editorial
              artifacts at speed. Get started in less than two minutes without
              payment credentials.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full md:w-auto">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary-container transition-all active:scale-[0.98] shadow-sm"
            >
              <span>Start Free 14-Day Trial</span>
              <Icon name="arrow_forward" size={18} />
            </Link>
            <Link
              href="/enterprise"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-surface-container-high text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-highest transition-colors"
            >
              Book Technical Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
