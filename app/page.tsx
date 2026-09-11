import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import WaitlistLink from "@/components/waitlist-link";
import { SectionHeading } from "@/components/section-heading";
import { getPublicPlans, PLANS, type Plan } from "@/lib/billing/plans";
import { PAID_PLAN_IDS, type PaidPlanId } from "@/lib/billing/paddle";
import { purchasedPlanIds } from "@/lib/billing/paddle";
import PricingCheckout from "@/components/pricing-checkout";

const STEPS = [
  {
    num: "01",
    title: "Add a recording",
    body: "Upload an audio or video file, or paste a YouTube link. No editing, no show notes required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z" />
      </svg>
    )
  },
  {
    num: "02",
    title: "We transcribe & write",
    body: "Gemini transcribes the episode, then writes each draft in a format hooked for that platform.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M12 3l1.9 5.7a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
      </svg>
    )
  },
  {
    num: "03",
    title: "Publish anywhere",
    body: "Copy the ready-to-edit drafts into LinkedIn, your newsletter, and your short-form feed.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    )
  }
];

const OUTPUTS = [
  {
    format: "LinkedIn post",
    body: "A grade-A narrative with a hook, short paragraphs tuned for the algorithm, and a call to action.",
    accent: "bg-primary-100 text-primary-500",
    meta: "Built for your feed"
  },
  {
    format: "Newsletter section",
    body: "A section you can drop into your next issue — opinionated, scannable, and true to your voice.",
    accent: "bg-secondary-100 text-secondary-600",
    meta: "For your next issue"
  },
  {
    format: "Short-form script",
    body: "A punchy 30–60s script with on-screen text cues, ready for reels, shorts, or TikToks.",
    accent: "bg-neutral-900 text-white",
    meta: "Reels · Shorts · TikTok"
  }
];

const AUDIENCES = [
  {
    title: "Solo creators & founders",
    body: "Record once a week and reach every platform without sacrificing your weekend to writing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    )
  },
  {
    title: "Podcast hosts",
    body: "Every episode becomes a LinkedIn post and a newsletter section — without hearing it twice.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <path d="M12 19v3" />
      </svg>
    )
  },
  {
    title: "Coaches & consultants",
    body: "Turn client calls and strategy sessions into content — no writer or editor on the payroll.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M3 3v18h18" />
        <path d="m7 15 4-6 4 3 5-7" />
      </svg>
    )
  }
];

const TESTIMONIALS = [
  {
    quote: "Used to spend 3 hours turning one episode into posts. Now it takes 15 minutes and the drafts are better than what I'd write tired.",
    name: "Alex M.",
    role: "Solo founder, weekly podcast"
  },
  {
    quote: "I don't want to sound like a generic content machine. VervAI keeps my voice and gives me something I'd actually publish.",
    name: "Priya R.",
    role: "LinkedIn creator, 12k followers"
  },
  {
    quote: "Our agency repackages client interviews into thought leadership without turning our writers into transcriptionists.",
    name: "James T.",
    role: "Content agency lead"
  },
  {
    quote: "The short-form scripts alone are worth it. We went from one post a week to a consistent short-form schedule.",
    name: "Sarah K.",
    role: "Brand strategist"
  }
];

const INPUTS = [
  {
    name: "YouTube",
    body: "Paste a link and we pull the captions straight from the video.",
    tag: "Paste a link",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </svg>
    )
  },
  {
    name: "Direct upload",
    body: "Drop in an audio or video file and we transcribe it for you.",
    tag: "Upload",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5" />
        <path d="M12 3v12" />
      </svg>
    )
  },
  {
    name: "Transcript files",
    body: "Bring your own transcript as an .srt, .vtt, or .txt file.",
    tag: ".srt · .vtt · .txt",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    )
  }
];

const FAQS = [
  {
    q: "What's the editing experience like?",
    a: "Each draft opens in a clean editor inside the app. You can rewrite inline, swap tone, expand, or trim before exporting."
  },
  {
    q: "Do I need a podcast to use this?",
    a: "No. Upload a video file, paste a YouTube link, or bring a transcript — podcast is just one input, not a requirement."
  },
  {
    q: "How is this different from ChatGPT?",
    a: "We're built around repurposing, not chat. The app understands your source media, enforces platform structure, and keeps outputs tied back to the original recording."
  },
  {
    q: "Is it really free?",
    a: "Yes. While VervAI is in beta, every account gets the Beta plan: 5 creation jobs a month, every output format, and all the drafting tools — at no cost. No credit card required."
  },
  {
    q: "What counts as a repurpose job?",
    a: "One recording, transcript, or YouTube video turned into up to five drafts (a LinkedIn post, a newsletter section, a short-form script, a thread, or a carousel). Watch the meter on the dashboard — each job deducts one."
  },
  {
    q: "Which content sources can I use?",
    a: "YouTube video links, uploaded audio or video files, and your own transcript files (.srt, .vtt, .txt). For YouTube you can connect a channel so captions pull in automatically."
  },
  {
    q: "What happens when I hit my monthly limit?",
    a: "Your 5 jobs reset at the start of every month, automatically. Drafts you've already generated stay in your Content Library — nothing is ever deleted. Failed or refunded jobs don't count toward the limit."
  },
  {
    q: "Can I get more than 5 jobs?",
    a: "Paid plans with more jobs, longer recordings, and regeneration are coming. Sign up during the beta and you'll be kept in the loop."
  }
];

// Grounded mock of the real product: the exact five drafts the app produces,
// with an honest in-progress state on one of them.
const DRAFT_PREVIEWS = [
  {
    format: "LinkedIn post",
    accent: "text-primary-500",
    state: "Draft ready",
    stateClass: "bg-primary-100 text-primary-700",
    hook: "We hit 50 users this week — and almost gave up twice. Here's what actually moved the needle:"
  },
  {
    format: "Newsletter section",
    accent: "text-secondary-600",
    state: "Ready to edit",
    stateClass: "bg-primary-100 text-primary-700",
    hook: "Scaling a solo build means designing your week around focus — not grinding longer hours."
  },
  {
    format: "Short-form script",
    accent: "text-neutral-900",
    state: "Generating…",
    stateClass: "bg-neutral-100 text-neutral-600",
    generating: true,
    hook: "50 users in 60 days. Three decisions that saved the project."
  }
];

export default function Home() {
  // Every public-facing plan (only Beta during the beta) — rendering derives
  // from config so the site never leaks an unpublished paid tier.
  const plans = getPublicPlans();
  const betaPlan = plans.find((p) => p.id === "beta");
  const availablePaidPlans = Object.values(PLANS).filter(
    (p): p is Plan & { id: PaidPlanId } => p.id !== "beta" && p.isPublic && p.available
  );
  const purchasable = purchasedPlanIds();

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="common-section relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="hero-glow absolute -top-24 right-[-10%] size-[420px] rounded-full bg-primary-100/60 blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] size-[360px] rounded-full bg-secondary-100/60 blur-3xl" />
        </div>

        <div className="container">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <span className="badge bg-primary-100 text-primary-500">
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
                  <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.6-6.3 4.6L8 13.8 2 9.2h7.6L12 2z" />
                </svg>
                One recording → five drafts
              </span>

              <h1 className="mt-5 font-display text-[32px] leading-[1.222] tracking-[-0.25px] md:text-[45px] md:leading-[1.156] lg:text-[57px] lg:leading-[1.123]">
                Turn one recording into{" "}
                <span className="text-primary-500">platform-ready drafts</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-normal tracking-[0.5px] text-theme-text-secondary">
                Upload a podcast or YouTube video. We write a LinkedIn post, a newsletter section, a short-form
                script, a thread, or a carousel — tuned for each platform, not reformatted text.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/upload" className="btn btn-primary px-8">
                  Start creating — it&apos;s free
                </Link>
                <Link href="/#how-it-works" className="btn btn-outline-primary px-8">
                  See how it works
                </Link>
              </div>

              <p className="mt-4 text-sm text-theme-text-secondary">
                Free during beta · No credit card required · Magic-link login
              </p>
            </div>

            {/* Product preview — real drafts, real formats */}
            <div className="relative mx-auto w-full max-w-lg">
              <div
                className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] bg-gradient-to-tr from-primary-500/15 via-transparent to-secondary-500/15 blur-2xl animate-pulse"
                aria-hidden="true"
              />
              <div className="hero-preview overflow-hidden rounded-xl border border-theme-divider bg-theme-bg-paper shadow-2xl shadow-neutral-900/10">
                <div className="flex items-center gap-1.5 border-b border-theme-divider bg-neutral-50 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-primary-300" />
                  <span className="size-2.5 rounded-full bg-secondary-300" />
                  <span className="size-2.5 rounded-full bg-neutral-300" />
                  <span className="ml-2 text-xs font-medium text-theme-text-secondary">
                    repurpose.ai
                  </span>
                  <span className="badge ml-auto bg-neutral-900 text-white">Ready</span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="caption uppercase tracking-wider text-theme-text-secondary">
                        Source
                      </p>
                      <p className="truncate font-display font-semibold text-theme-text-primary">
                        Episode 12 — Building in public
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-theme-text-secondary">42 min</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {DRAFT_PREVIEWS.map((d) => (
                      <div key={d.format} className="rounded-lg bg-neutral-100 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`caption uppercase tracking-wider ${d.accent}`}>
                            {d.format}
                          </p>
                          <span className={`badge ${d.stateClass}`}>{d.state}</span>
                        </div>
                        <p className="mt-2 text-sm leading-normal text-theme-text-secondary">
                          {d.hook}
                        </p>
                        {d.generating && (
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                            <div className="h-full w-2/3 rounded-full bg-primary-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 flex items-center gap-1.5 text-xs text-theme-text-secondary">
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-3 text-primary-500"
                      aria-hidden="true"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    </svg>
                    Generated with Gemini — drafts stream in as they finish
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="common-section border-b border-theme-divider" aria-label="Testimonials">
        <div className="container">
          <div className="grid gap-6 md:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="rounded-lg border border-theme-divider bg-theme-bg-paper p-5 transition-colors hover:border-primary-200 hover:shadow-sm"
              >
                <p className="text-sm leading-normal text-theme-text-secondary">“{t.quote}”</p>
                <footer className="mt-4 flex items-center gap-3">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600"
                    aria-hidden="true"
                  >
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <span className="text-xs">
                    <span className="font-medium text-theme-text-primary">{t.name}</span>
                    <span className="text-theme-text-secondary"> · {t.role}</span>
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="common-section bg-neutral-50">
        <div className="container">
          <SectionHeading
            kicker="Who it's for"
            title="Built for creators who publish more than they record"
            body="If a one-hour conversation can feed a whole week of publishing, VervAI does the writing so you don't have to."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.title}
                className="rounded-lg border border-theme-divider bg-theme-bg-paper p-6"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                  {a.icon}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-normal text-theme-text-secondary">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="common-section bg-neutral-100">
        <div className="container">
          <SectionHeading
            kicker="How it works"
            title="Record once, publish everywhere"
            body="No editing, no show notes, no frantic re-writes. Three steps from audio to published."
          />

          <div className="relative mt-12 grid gap-6 md:grid-cols-3">
            <div
              className="absolute left-[16.66%] right-[16.66%] top-6 hidden border-t border-dashed border-theme-divider md:block"
              aria-hidden="true"
            />
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="relative rounded-lg border border-theme-divider bg-theme-bg-paper p-6 transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="relative z-10 flex size-11 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                    {step.icon}
                  </span>
                  <span className="font-display text-3xl font-bold text-neutral-300">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-normal text-theme-text-secondary">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Outputs */}
      <section id="outputs" className="common-section">
        <div className="container">
          <SectionHeading
            kicker="The outputs"
            title="Three drafts, each built for its platform"
            body="Same episode, different jobs. Each draft understands where it's going to live."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {OUTPUTS.map((o) => (
              <div
                key={o.format}
                className="flex flex-col rounded-xl border border-theme-divider bg-theme-bg-paper p-6 transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`badge ${o.accent}`}>{o.format}</span>
                  <span className="badge border border-theme-divider bg-white/60 text-neutral-500">
                    {o.meta}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-normal text-theme-text-secondary">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inputs — the feed sources we actually support */}
      <section className="common-section bg-neutral-100">
        <div className="container">
          <SectionHeading
            kicker="Bring any recording"
            title="Works with how you already capture content"
            body="No new recording setup. Feed it what you already have."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {INPUTS.map((input) => (
              <div
                key={input.name}
                className="rounded-lg border border-theme-divider bg-theme-bg-paper p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-secondary-100 text-secondary-600">
                    {input.icon}
                  </span>
                  <span className="badge bg-neutral-100 text-neutral-600">{input.tag}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{input.name}</h3>
                <p className="mt-2 text-sm leading-normal text-theme-text-secondary">
                  {input.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="common-section">
        <div className="container">
          <SectionHeading
            kicker="Pricing"
            title="Free during beta"
            body="We're validating VervAI in the open — you get real, working limits while we do, all on us."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {betaPlan && (
              <div className="md:col-span-2">
                <div className="flex flex-col rounded-xl border-2 border-neutral-900 bg-neutral-900 p-6 text-white shadow-2xl shadow-neutral-900/20 sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">{betaPlan.name} plan</p>
                      <p className="mt-1 text-sm text-neutral-400">{betaPlan.tagline}</p>
                    </div>
                    <span className="badge bg-primary-500 text-white">Limited beta</span>
                  </div>

                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-bold">{betaPlan.displayPrice}</span>
                    <span className="text-sm text-neutral-400">during beta</span>
                  </p>

                  <div className="mt-6 grid grid-cols-3 gap-3 rounded-lg bg-neutral-800/60 p-4 text-center">
                    <div>
                      <p className="font-display text-2xl font-bold tabular-nums">
                        {betaPlan.limits.maxJobsPerMonth}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">jobs / month</p>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-bold tabular-nums">
                        {betaPlan.limits.maxInputMinutes}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">min / recording</p>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-bold tabular-nums">
                        {betaPlan.limits.maxOutputsPerJob}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">outputs / job</p>
                    </div>
                  </div>

                  <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                    {betaPlan.includes.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-neutral-300">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4 text-primary-500"
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/upload"
                    className="btn mt-8 w-full bg-white text-neutral-900 hover:bg-neutral-100"
                  >
                    Start free — no credit card
                  </Link>
                  <p className="mt-4 text-center text-xs text-neutral-400">
                    Early users keep beta access and shape the roadmap.
                  </p>
                </div>
              </div>
            )}

            <div className="md:col-span-2 grid gap-6 md:grid-cols-3">
              {availablePaidPlans.length > 0
                ? availablePaidPlans.map((tier) => {
                    const canPurchase = purchasable.includes(tier.id);
                    return (
                      <div
                        key={tier.id}
                        className={`flex flex-col rounded-xl border bg-theme-bg-paper p-5 text-center transition-colors hover:border-primary-200 hover:shadow-md ${
                          canPurchase ? "border-theme-divider" : "border-dashed border-theme-divider"
                        }`}
                      >
                        <p className="font-display text-base font-semibold text-theme-text-primary">{tier.name}</p>
                        <p className="mt-1 text-xs text-theme-text-secondary">{tier.tagline}</p>
                        <p className="mt-4 text-2xl font-bold tabular-nums">{tier.displayPrice}</p>
                        <ul className="mt-4 flex flex-col gap-2 text-left text-xs text-theme-text-secondary">
                          <li>{tier.limits.maxJobsPerMonth == null ? "Unlimited jobs" : `${tier.limits.maxJobsPerMonth} jobs / month`}</li>
                          <li>Up to {tier.limits.maxInputMinutes} min / recording</li>
                          <li>{tier.limits.maxOutputsPerJob} outputs / job</li>
                        </ul>
                        <div className="mt-auto pt-5">
                          <p className="text-xs text-theme-text-secondary">
                            Use the checkout below to upgrade.
                          </p>
                        </div>
                      </div>
                    );
                  })
                : [
                    { name: "Creator", angle: "More jobs, same workflow" },
                    { name: "Pro", angle: "Regeneration + longer inputs" },
                    { name: "Studio", angle: "Teams, reuse, and higher limits" }
                  ].map((tier) => (
                    <div
                      key={tier.name}
                      className="flex flex-col rounded-xl border border-dashed border-theme-divider bg-theme-bg-paper p-5 text-center transition-colors hover:border-primary-200 hover:shadow-md"
                    >
                      <p className="font-display text-base font-semibold text-theme-text-primary">{tier.name}</p>
                      <p className="mt-1 text-xs text-theme-text-secondary">{tier.angle}</p>
                      <p className="mt-auto pt-4 text-xs text-theme-text-secondary">
                        Coming after beta — <WaitlistLink className="font-medium text-primary-500 underline underline-offset-2" />
                      </p>
                    </div>
                  ))}
            </div>

            <div className="mx-auto mt-10">
              <PricingCheckout availablePlans={purchasable} />
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-2xl">
            <h3 className="font-display text-center text-xl font-semibold">Common questions</h3>
            <div className="mt-6 flex flex-col gap-3">
              {FAQS.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-lg border border-theme-divider bg-theme-bg-paper px-5 py-4 transition-colors hover:border-primary-200"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-theme-text-primary">
                    <span className="flex items-center justify-between gap-3">
                      {f.q}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4 shrink-0 text-theme-text-secondary transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-normal text-theme-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="common-section bg-neutral-50">
        <div className="container">
          <div className="relative overflow-hidden rounded-xl bg-primary-500 px-6 py-16 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -top-16 right-10 size-56 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-20 left-10 size-72 rounded-full bg-white/10 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-[32px] leading-[1.222] font-bold md:text-[45px] md:leading-[1.156]">
                Your next post is already in your recording.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-normal text-primary-100">
                Add a recording and watch it become a LinkedIn post, a newsletter section, a
                short-form script, a thread, or a carousel in minutes — free during the beta.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/upload" className="btn bg-white px-8 text-primary-500 hover:bg-primary-50">
                  Get started — it&apos;s free
                </Link>
                <Link href="/login" className="btn border border-white/40 px-8 text-white hover:bg-white/10">
                  Log in
                </Link>
              </div>
              <p className="mt-6 text-sm text-primary-100">
                Free during beta · No credit card · Magic-link login
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}