"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "./logo";

const NAV_GROUPS = [
  {
    label: "Home",
    items: [
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
            className="size-[18px]"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Create",
    items: [
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
            className="size-[18px]"
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
        label: "New content",
        href: "/upload",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Library",
    items: [
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
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="m12 2 10 5-10 5L2 7 12 2Z" />
            <path d="m2 17 10 5 10-5" />
            <path d="m2 12 10 5 10-5" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Strategy",
    items: [
      {
        label: "Content calendar",
        href: "/content/calendar",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Insights",
    items: [
      {
        label: "AI learnings",
        href: "/agent/observe",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M3 3v18h18" />
            <path d="M7 14l3-3 3 3 5-6" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Brand",
    items: [
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
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
            <path d="M1 14h6M9 8h6M17 16h6" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Connect",
    items: [
      {
        label: "Channels",
        href: "/connections",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
          </svg>
        )
      }
    ]
  },
  {
    label: "Account",
    items: [
      {
        label: "Plan & usage",
        href: "/settings/usage",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        )
      },
      {
        label: "Settings",
        href: "/settings",
        icon: (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        )
      }
    ]
  }
];

function NavLinks({
  isActive,
  onNavigate
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="caption px-4 pt-2 pb-1 uppercase tracking-wider text-theme-text-secondary">
            {group.label}
          </p>
          {group.items.map((item) => (
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
        </div>
      ))}
    </>
  );
}

function SidebarContent({
  isActive,
  onNavigate,
  onClose,
  topBarRight
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  topBarRight?: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between px-6 py-6">
        <Logo href="/dashboard" />
        {topBarRight}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4 py-2">
        <NavLinks isActive={isActive} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-theme-divider px-4 py-4">
        <button
          type="button"
          onClick={() => {
            onClose?.();
            handleSignOut();
          }}
          className="side-nav-link text-left"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Log out
        </button>
        <nav className="mt-2 flex gap-3 px-4 text-xs text-theme-text-secondary">
          <Link href="/legal/terms" className="hover:text-theme-text-primary hover:underline">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-theme-text-primary hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

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
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-theme-divider bg-theme-bg-paper lg:flex">
        <SidebarContent isActive={isActive} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-theme-divider bg-theme-bg-paper px-4 py-3 lg:hidden">
          <span className="text-lg font-bold text-theme-text-primary">Repurpose</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="nav-link"
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
        </header>

        <main className="flex-1">{children}</main>
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
                  className="nav-link"
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