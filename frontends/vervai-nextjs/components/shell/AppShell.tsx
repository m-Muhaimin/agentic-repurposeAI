"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";
import Icon from "@/components/ui/Icon";
import { ButtonLink } from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import SignOutButton from "@/components/auth/SignOutButton";
import { NAV_SECTIONS, BOTTOM_NAV, activeKeyForPath } from "@/lib/nav";

function SidebarNav({
  activeKey,
  onNavigate,
  userEmail,
  userName,
  userAvatar,
}: {
  activeKey: string | null;
  onNavigate?: () => void;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
}) {
  const base = (active: boolean) =>
    `flex items-center gap-space-sm px-space-sm py-1.5 rounded transition-colors ${
      active
        ? "bg-primary text-on-primary font-bold shadow-sm"
        : "text-on-surface-variant font-body-medium text-body-medium hover:bg-surface-container-high hover:text-on-surface"
    }`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-space-sm py-space-md space-y-space-md">
        {NAV_SECTIONS.map((section) => (
          <div className="space-y-1" key={section.section}>
            <p className="px-space-sm font-label-caps text-label-caps text-outline uppercase tracking-wider mb-space-xs">
              {section.section}
            </p>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.activeKey === activeKey;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={base(active)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-space-sm border-t border-outline-variant/40 bg-surface-container-lowest shrink-0 space-y-space-xs">
        <nav className="space-y-0.5">
          {BOTTOM_NAV.map((item) => {
            const active = item.activeKey === activeKey;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={base(active)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between p-space-sm rounded bg-surface-container-low/70 border border-outline-variant/30 mt-space-xs">
          <Link href="/account" className="flex items-center gap-space-sm min-w-0 group">
            <Avatar
              src={userAvatar ?? ""}
              name={userName ?? userEmail ?? "Account"}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <p className="font-caption-bold text-caption-bold text-on-surface truncate leading-tight">
                {userName ?? userEmail ?? "Account"}
              </p>
              {userEmail ? (
                <p className="font-label-caps text-[10px] text-secondary truncate">
                  {userName ? userEmail : "Signed in"}
                </p>
              ) : null}
            </div>
          </Link>
          <SignOutButton className="text-outline hover:text-error transition-colors p-1 rounded hover:bg-surface-container-high" />
        </div>
      </div>
    </div>
  );
}

function BrandRow() {
  return (
    <div className="h-14 px-space-md border-b border-outline-variant/30 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-space-sm">
        <Logo size={32} />
        <span className="font-headline-md text-headline-md text-on-surface tracking-tight">
          VervAI
        </span>
      </div>
      <span className="font-label-caps text-label-caps uppercase text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
        v2.4
      </span>
    </div>
  );
}

export default function AppShell({
  children,
  userEmail,
  userName,
  userAvatar,
  planLabel,
  creditsLabel,
}: {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  planLabel?: string;
  creditsLabel?: string;
}) {
  const pathname = usePathname() ?? "/";
  const activeKey = activeKeyForPath(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-surface-container-lowest border-r border-outline-variant/40 z-40 flex-col justify-between select-none">
        <BrandRow />
        <SidebarNav
          activeKey={activeKey}
          userEmail={userEmail}
          userName={userName}
          userAvatar={userAvatar}
        />
      </aside>
      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm transition-opacity ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-outline-variant/40 flex flex-col justify-between shadow-xl transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <BrandRow />
          <SidebarNav
            activeKey={activeKey}
            onNavigate={() => setMobileOpen(false)}
            userEmail={userEmail}
            userName={userName}
            userAvatar={userAvatar}
          />
        </aside>
      </div>

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-14 bg-surface/90 backdrop-blur-md border-b border-outline-variant/40 flex items-center justify-between px-space-lg">
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              className="lg:hidden p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="items-center gap-space-md hidden lg:flex">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/40">
                <span className="font-caption-bold text-caption-bold text-on-surface">
                  Workspace
                </span>
              </div>
              <span className="text-outline-variant hidden sm:block">/</span>
              <span className="font-body-sm text-body-sm text-secondary font-medium hidden sm:block">
                Autonomous Suite
              </span>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-space-lg hidden md:block">
            <div className="relative flex items-center w-full">
              <Icon name="search" size={18} className="text-outline absolute left-3 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-12 rounded bg-surface-container-lowest border border-outline-variant/50 text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
                placeholder="Search content, sources, or run an action..."
                type="text"
              />
              <div className="absolute right-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-label-caps text-secondary border border-outline-variant/40">
                ⌘K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            {planLabel ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high border border-outline-variant/40 hidden sm:inline-flex">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                <span className="font-caption-bold text-caption-bold text-on-surface">
                  {planLabel}
                </span>
              </div>
            ) : null}
            {creditsLabel ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high border border-outline-variant/40 hidden sm:inline-flex">
                <span className="font-caption-bold text-caption-bold text-on-surface">
                  {creditsLabel}
                </span>
              </div>
            ) : null}
            <ButtonLink href="/source-intake" size="sm">
              <Icon name="add" size={16} />
              <span>Create</span>
            </ButtonLink>
            <Link
              href="/notifications"
              className="relative p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Notifications"
            >
              <Icon name="notifications" size={20} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary ring-2 ring-surface" />
            </Link>
            <Link href="/account" className="flex items-center pl-1 shrink-0" aria-label="Account">
              <Avatar
                src={userAvatar ?? ""}
                name={userName ?? userEmail ?? "Account"}
                size={32}
              />
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full bg-surface px-gutter-mobile sm:px-gutter lg:px-space-lg py-space-md max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </>
  );
}