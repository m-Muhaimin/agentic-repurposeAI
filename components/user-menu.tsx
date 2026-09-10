"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";

// Account dropdown in the sticky top bar: Channels / Plan & usage / Settings +
// a real Log out. These live here, not in the sidebar. The button shows the
// signed-in user's initials; every link is a plain route, nothing invented.

const ACCOUNT_ITEMS = [
  { label: "Channels", href: "/connections" },
  { label: "Plan & usage", href: "/settings/usage" },
  { label: "Settings", href: "/settings" }
] as const;

function initialsOf(email: string | null | undefined): string {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  const first = local[0] ?? "U";
  const second = local[1]; // a one-letter local part shouldn't give "UU"
  return second ? `${first}${second}`.toUpperCase() : first.toUpperCase();
}

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setEmail(session?.user?.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Close on navigation and on outside click / Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[34px] items-center gap-2 rounded-full border border-theme-divider bg-theme-bg-paper py-1 pl-1 pr-2.5 text-theme-text-primary transition-colors hover:bg-primary-500/[0.04] hover:text-theme-text-primary"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-semibold text-white">
          {initialsOf(email)}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("size-3.5 text-theme-text-secondary transition-transform", open && "rotate-180")}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id="user-menu"
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 max-w-[calc(100vw-2rem)] animate-fade-in rounded-xl border border-theme-divider bg-theme-bg-paper p-1.5 shadow-xl"
        >
          {email && (
            <p className="caption truncate px-3 pb-1 pt-2 text-theme-text-secondary">{email}</p>
          )}
          {ACCOUNT_ITEMS.map((item, index) => (
            <div key={item.href} className={clsx(index > 0 && "mt-0.5")}>
              <Link
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-primary-100 font-medium text-primary-500"
                    : "text-theme-text-primary hover:bg-primary-500/[0.04] hover:text-theme-text-primary"
                )}
              >
                {item.label}
              </Link>
            </div>
          ))}
          <div role="separator" className="my-1 border-t border-theme-divider" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void handleSignOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}