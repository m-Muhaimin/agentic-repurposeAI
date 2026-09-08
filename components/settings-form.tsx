"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader } from "@/components/card";

export default function SettingsForm({ email, name: initialName }: { email: string; name: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [signedOut, setSignedOut] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: name.trim() } });
      if (error) throw error;
      setProfileStatus({ ok: true, text: "Saved." });
    } catch (err) {
      setProfileStatus({
        ok: false,
        text: err instanceof Error ? err.message : "Could not save your profile."
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    setSignedOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Profile */}
      <Card>
        <CardHeader
          title="Profile"
          description="Your name is used in the workspace. Your email is how you sign in."
        />
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label htmlFor="name" className="form-label">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-control"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              disabled
              className="form-control opacity-70"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            {profileStatus && (
              <p
                role={profileStatus.ok ? "status" : "alert"}
                className={`text-xs ${profileStatus.ok ? "text-theme-text-secondary" : "text-red-600"}`}
              >
                {profileStatus.text}
              </p>
            )}
            <button
              type="submit"
              disabled={savingProfile || name.trim() === initialName}
              className="btn btn-primary btn-sm ml-auto disabled:opacity-50"
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader
          title="Preferences"
          description="Optional alerts, coming soon."
        />
        <div className="px-5 py-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-theme-divider p-4">
            <div>
              <p className="text-sm font-medium text-theme-text-primary">In-app alerts</p>
              <p className="text-xs text-theme-text-secondary">
                Notifications when drafts are ready or processing fails — we&apos;re building these
                and they aren&apos;t live yet.
              </p>
            </div>
            <span className="badge bg-neutral-900 text-white shrink-0">Coming soon</span>
          </div>
        </div>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader title="Account" />
        <div className="flex flex-col gap-4 px-5 py-5">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signedOut}
            className="btn btn-outline-primary btn-sm self-start disabled:opacity-50"
          >
            {signedOut ? "Signing out…" : "Sign out"}
          </button>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Delete account</p>
            <p className="mt-1 text-xs text-red-600/80">
              Permanently removes your content, drafts, and connections. Account deletion isn&apos;t
              available self-serve yet.
            </p>
          </div>
        </div>
      </Card>

      {/* Privacy */}
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-theme-text-primary">Privacy</p>
          <p className="mt-0.5 text-xs text-theme-text-secondary">
            Your content is private to your account.
          </p>
        </div>
        <Link href="/legal/privacy" className="btn btn-outline-primary btn-sm shrink-0">
          Privacy policy
        </Link>
      </Card>
    </div>
  );
}