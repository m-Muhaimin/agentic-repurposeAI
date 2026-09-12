"use client";

import { useState } from "react";
import TextInput from "@/components/ui/TextInput";
import Select from "@/components/ui/Select";

const TIMEZONES = [
  "America/New_York (EDT) - UTC-4",
  "America/Los_Angeles (PDT) - UTC-7",
  "Europe/London (BST) - UTC+1",
  "Europe/Berlin (CEST) - UTC+2",
  "Asia/Tokyo (JST) - UTC+9",
];

const LOCALES = [
  "English (United States) — en_US",
  "English (United Kingdom) — en_GB",
  "Deutsch (Deutschland) — de_DE",
  "Français (France) — fr_FR",
];

type ProfileSectionProps = {
  email: string | null;
  name?: string | null;
  userId?: string | null;
  plan?: string | null;
};

function initialsOf(value: string | null): string {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileSection({ email, name, userId, plan }: ProfileSectionProps) {
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const isFree = plan ? /free|starter|basic|trial|hobby|none/i.test(plan) : null;
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Not configured";
  const identity = name ?? email;

  return (
    <section
      id="general-profile"
      className="lg:col-span-12 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-lg scroll-mt-8"
    >
      <div className="flex items-center justify-between pb-space-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Personal Profile & Identity
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Identity details come from your signed-in authentication session.
            </p>
          </div>
        </div>
        <span className="font-caption-bold text-caption-bold uppercase tracking-wider text-on-surface-variant px-3 py-1 bg-surface-container rounded-full">
          {planLabel}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-space-xl items-start">
        <div className="md:col-span-4 flex flex-col items-center sm:items-start p-space-lg bg-surface-container-low rounded-xl gap-space-md">
          <span className="w-28 h-28 rounded-2xl bg-surface-container-highest text-primary flex items-center justify-center font-headline-lg text-headline-lg shadow-sm ring-4 ring-surface-container-lowest">
            {initialsOf(identity)}
          </span>
          <div className="flex flex-col text-center sm:text-left">
            <h3 className="font-headline-md text-headline-md text-on-surface">{name ?? "Account"}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant font-medium">
              {email ?? "Email hidden"}
            </p>
          </div>
          <div className="w-full flex items-center justify-between pt-2">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
              Current Plan
            </span>
            <span className="font-body-sm text-body-sm text-on-surface font-semibold bg-surface-container-highest px-2 py-0.5 rounded">
              {planLabel}
            </span>
          </div>
          <div className="w-full flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-outline uppercase tracking-wider">
              Account ID
            </span>
            <span className="font-body-sm text-body-sm text-on-surface font-semibold bg-surface-container-highest px-2 py-0.5 rounded font-mono">
              {userId ? userId.slice(0, 8) : "—"}
            </span>
          </div>
        </div>
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-space-md">
          <div className="flex flex-col gap-1.5">
            <label className="font-body-medium text-body-sm text-on-surface font-semibold flex items-center justify-between">
              <span>Full Name</span>
              <span className="text-outline text-[11px]">From sign-in</span>
            </label>
            <TextInput value={name ?? ""} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body-medium text-body-sm text-on-surface font-semibold flex items-center justify-between">
              <span>Email Address</span>
              <span className="text-outline text-[11px]">From sign-in</span>
            </label>
            <TextInput type="email" value={email ?? ""} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body-medium text-body-sm text-on-surface font-semibold">
              Timezone
            </label>
            <Select
              value={timezone}
              placeholder="Not configured"
              onChange={(e) => setTimezone(e.target.value)}
              options={TIMEZONES.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-body-medium text-body-sm text-on-surface font-semibold">
              Language & Editorial Locale
            </label>
            <Select
              value={locale}
              placeholder="Not configured"
              onChange={(e) => setLocale(e.target.value)}
              options={LOCALES.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="sm:col-span-2 pt-2 flex items-center justify-between gap-space-md">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Name, email, and account identity are managed by your authentication session and
              cannot be edited here. Timezone and locale are not persisted yet.
            </p>
            {isFree === true && (
              <button
                className="flex items-center gap-2 px-space-lg py-2.5 rounded-lg font-body-medium text-body-medium bg-primary text-on-primary hover:bg-primary-container shadow-md transition-all active:scale-[0.98] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                disabled
                title="Coming soon"
              >
                <span className="material-symbols-outlined text-[18px]">upgrade</span>
                <span>Upgrade Plan</span>
                <span className="font-label-caps text-[10px] text-on-surface-variant uppercase ml-1">Coming soon</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}