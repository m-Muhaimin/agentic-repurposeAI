import SignInProviders from "@/components/auth/SignInProviders";
import SignInForm from "@/components/auth/SignInForm";
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <div className="flex flex-col w-full items-center justify-center">
        <div className="w-full max-w-[1040px] grid grid-cols-1 lg:grid-cols-12 bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden">
          <div className="lg:col-span-5 bg-surface-container-low p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary-fixed opacity-40 blur-3xl pointer-events-none"></div>
            <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-secondary-fixed opacity-30 blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-on-surface flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-surface-bright" fill="none" viewBox="0 0 40 40">
                    <path d="M10 11L20 29L30 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5"></path>
                    <circle cx={20} cy={20} fill="#007454" r={3.5}></circle>
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-md text-headline-md tracking-tight text-on-surface">VervAI</span>
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-outline">Autonomous Grid</span>
                </div>
              </div>
              <div className="pt-4">
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-snug">
                  Your publishing pipeline, all in one place.
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                  Research, draft, approve, and schedule content across every channel you already use.
                </p>
              </div>
            </div>
            <div className="relative z-10 my-8 bg-surface-container-lowest rounded-lg p-5 shadow-sm space-y-3">
              <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">
                Inside your workspace
              </span>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">graphic_eq</span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    Ingest podcasts, videos, and transcripts into a searchable library.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">auto_awesome</span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    Agents draft posts, newsletters, scripts, and threads from your sources.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">send</span>
                  <span className="font-caption-bold text-caption-bold text-on-surface-variant">
                    Approve and schedule distribution across connected channels.
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-between bg-surface-container-lowest">
            <div className="w-full max-w-md mx-auto">
              <div className="mb-8">
                <h1 className="font-display-xl text-display-xl text-on-surface mt-2 tracking-tight">Welcome back</h1>
                <p className="font-body-medium text-body-medium text-on-surface-variant mt-1.5">
                  Sign in to your workspace to continue where you left off.
                </p>
              </div>
              <SignInProviders />
              <div className="relative flex py-2 items-center mb-8">
                <div className="flex-grow bg-surface-variant h-px"></div>
                <span className="flex-shrink mx-4 font-caption-bold text-caption-bold text-outline uppercase tracking-wider">
                  or sign in with email
                </span>
                <div className="flex-grow bg-surface-variant h-px"></div>
              </div>
              <Suspense>
                <SignInForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}