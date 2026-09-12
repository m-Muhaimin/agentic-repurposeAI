import { createClient } from "@/lib/supabase/server";
import { getAgentPreferences, getProfile } from "@/lib/data";
import ProfileSection from "@/components/preferences/ProfileSection";
import AgentDefaults from "@/components/preferences/AgentDefaults";
import NotificationSettings from "@/components/preferences/NotificationSettings";
import DataSovereignty from "@/components/preferences/DataSovereignty";
import PreferencesTabs from "@/components/preferences/PreferencesTabs";
import ApplyBar from "@/components/preferences/ApplyBar";
import PreferencesManager from "@/components/preferences/PreferencesManager";

function metadataName(user: { user_metadata?: unknown } | null): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta.full_name === "string" ? meta.full_name : null;
  const name = typeof meta.name === "string" ? meta.name : null;
  return full ?? name;
}

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;

  const [prefs, profile] = await Promise.all([
    getAgentPreferences(),
    getProfile(),
  ]);

  const email = user?.email ?? null;
  const name = metadataName(user);
  const userId = user?.id ?? null;
  const plan = profile?.plan ?? null;
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Free";

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-7xl w-full mx-auto space-y-space-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Account</span>
            <span className="text-outline-variant">/</span>
            <span className="text-primary font-semibold">Configuration & System Preferences</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mt-1">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Preferences & Workspace Settings
            </h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-caption-bold text-caption-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Plan: {planLabel}
              </span>
            </div>
          </div>
          <p className="font-body-base text-body-medium text-on-surface-variant max-w-3xl">
            Manage your personal profile, notification preferences, default agent behaviors,
            editorial safeguards, and data retention settings.
          </p>
        </div>
        <PreferencesManager prefs={prefs}>
          <PreferencesTabs />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
            <ProfileSection email={email} name={name} userId={userId} plan={plan} />
            <AgentDefaults />
            <NotificationSettings />
            <DataSovereignty />
          </div>
          <ApplyBar />
        </PreferencesManager>
      </div>
    </div>
  );
}