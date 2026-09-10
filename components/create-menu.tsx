"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

// One global creation action for the shell: "What do you want to accomplish?"
// Everything here links to existing pages — nothing is invented. Mounted in the
// desktop sidebar and the mobile top bar; each instance owns its open state.

const ACTIONS = [
  {
    href: "/upload",
    title: "Create from content",
    body: "Create drafts from a new upload, transcript, or YouTube link.",
    icon: (
      <path d="M12 5v14M5 12h14" />
    )
  },
  {
    href: "/agent",
    title: "Agent",
    body: "Describe a goal — it plans, you approve, then it drafts.",
    icon: (
      <>
        <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
        <path d="M19 11a7 7 0 0 1-14 0" />
        <path d="M12 18v3" />
        <path d="M8 21h8" />
      </>
    )
  },
  {
    href: "/library",
    title: "See your library",
    body: "Browse sources and ready drafts from before.",
    icon: (
      <>
        <path d="m12 2 10 5-10 5L2 7 12 2Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </>
    )
  }
];

export default function CreateMenu({
  variant = "sidebar"
}: {
  variant?: "sidebar" | "topbar";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on navigation.
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

  const alignRight = variant === "topbar";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="create-menu"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "btn btn-primary flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-1.5",
          variant === "sidebar" && "w-full"
        )}
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
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("size-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id="create-menu"
          role="menu"
          aria-label="Create"
          className={clsx(
            "z-50 w-80 max-w-[calc(100vw-2rem)] animate-fade-in rounded-xl border border-theme-divider bg-theme-bg-paper p-2 shadow-xl",
            alignRight
              ? "fixed right-4 top-[76px]"
              : "absolute left-0 top-[calc(100%+8px)]"
          )}
        >
          <p className="caption px-3 pb-1 pt-2 text-theme-text-secondary">
            What do you want to accomplish?
          </p>
          {ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-primary-500/[0.04] hover:text-theme-text-primary"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-500">
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
                  {action.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-theme-text-primary">
                  {action.title}
                </span>
                <span className="mt-0.5 block text-xs leading-normal text-theme-text-secondary">
                  {action.body}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}