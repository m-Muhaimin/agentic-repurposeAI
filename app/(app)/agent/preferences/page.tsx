"use client";

import PageHeader from "@/components/page-header";
import PreferencesForm from "@/components/agent/preferences-form";

// Agent preferences — the Stage 2 memory surface (brand voice + autonomy mode
// + confidence-gated suggestions). Auth is handled by middleware (`/agent` is
// protected); the page shells the client form, which owns all fetching.

export default function AgentPreferencesPage() {
  return (
    <div className="workspace py-8 lg:py-10">
      <PageHeader
        title="Agent preferences"
        description="How VervAI writes for you: set your autonomy mode and brand voice, and act on the patterns it learns from your edits. Your voice is never rewritten without your approval."
      />
      <PreferencesForm />
    </div>
  );
}