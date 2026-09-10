"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./logo";
import CreateMenu from "./create-menu";
import UserMenu from "./user-menu";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    )
  },
  {
    label: "Agent",
    href: "/agent",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
        <path d="M19 11a7 7 0 0 1-14 0" />
        <path d="M12 18v3" />
        <path d="M8 21h8" />
      </svg>
    )
  },
  {
    label: "Content library",
    href: "/library",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <path d="m12 2 10 5-10 5L2 7 12 2Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    )
  },
  {
    label: "Publish queue",
    href: "/publish",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <path d="M17 8l4-4m0 0-4-4m4 4h-9a6 6 0 0 0-6 6v7" />
        <path d="M7 16l-4 4m0 0 4 4m-4-4h9a6 6 0 0 0 6-6v-7" />
      </svg>
    )
  },
  {
    label: "AI insights",
    href: "/agent/observe",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <path d="M3 3v18h18" />
        <path d="M7 14l3-3 3 3 5-6" />
      </svg>
    )
  },
  {
    label: "Brand & voice",
    href: "/branding",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[16px]"
        aria-hidden="true"
      >
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </svg>
    )
  }
];

const NAV_HREFS = NAV_ITEMS.map((item) => item.href);

// Longest prefix wins, so subtree routes map back to their parent — the editor
// (`/repurpose/*`) resolves to Content library — so the user never loses
// orientation. Settings/Channels/Plan & usage moved to the top-bar account menu
// and are no longer sidebar items.
function resolveActiveHref(pathname: string): string {
  if (pathname.startsWith("/repurpose/")) return "/library";
  let best: string | null = null;
  for (const href of NAV_HREFS) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (best === null || href.length > best.length) best = href;
    }
  }
  return best ?? "";
}

// Page titles for the sticky top bar, ordered longest-prefix last-match wins.
const TOP_BAR_TITLES: Array<[string, string]> = [
  ["/content", "Content calendar"],
  ["/agent/observe", "AI insights"],
  ["/settings/usage", "Plan & usage"],
  ["/repurpose", "Content library"],
  ["/dashboard", "Overview"],
  ["/agent", "Agent"],
  ["/library", "Content library"],
  ["/publish", "Publish queue"],
  ["/branding", "Brand & voice"],
  ["/connections", "Channels"],
  ["/settings", "Settings"],
  ["/upload", "Create from content"]
];

function resolveTopBarTitle(pathname: string): string {
  let best: [string, string] | null = null;
  for (const entry of TOP_BAR_TITLES) {
    if (pathname === entry[0] || pathname.startsWith(`${entry[0]}/`)) {
      if (best === null || entry[0].length > best[0].length) best = entry;
    }
  }
  return best?.[1] ?? "VervAI";
}

function NavLinks({
  isActive,
  onNavigate
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`side-nav-link ${isActive(item.href) ? "active" : ""}`}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </>
  );
}

function SidebarContent({
  isActive,
  onNavigate,
  createMenu,
  topBarRight
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
  createMenu?: React.ReactNode;
  topBarRight?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <Logo href="/dashboard" />
        {topBarRight}
      </div>

      {createMenu && <div className="px-3 pt-3">{createMenu}</div>}

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        <NavLinks isActive={isActive} onNavigate={onNavigate} />
      </nav>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeHref = resolveActiveHref(pathname);
  const title = resolveTopBarTitle(pathname);
  const isActive = (href: string) => href === activeHref;

  // Close the drawer on route change.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open, and close on Escape.
  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-neutral-50 lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-theme-divider bg-theme-bg-paper lg:flex">
        <SidebarContent isActive={isActive} createMenu={<CreateMenu />} />
      </aside>

      {/* Content column: sticky top bar + page */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-theme-divider bg-theme-bg-paper/95 px-4 py-2.5 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="nav-link -ml-2 lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="mobile-sidebar"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <h1 className="truncate font-display text-[17px] font-bold tracking-tight text-theme-text-primary">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <CreateMenu variant="topbar" />
            </div>
            <UserMenu />
          </div>
        </header>

        <main id="main-content" className="flex-1">{children}</main>
      </div>

      {/* Mobile collapsible sidebar (drawer) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-neutral-900/40"
            aria-label="Close menu"
          />
          <aside
            id="mobile-sidebar"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-theme-divider bg-theme-bg-paper"
          >
            <SidebarContent
              isActive={isActive}
              onNavigate={() => setSidebarOpen(false)}
              topBarRight={
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="nav-link -mr-2 min-h-[34px]"
                  aria-label="Close menu"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              }
            />
          </aside>
        </div>
      )}
    </div>
  );
}