"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import Icon from "@/components/ui/Icon";

const LINKS = [
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/workflows" },
  { label: "Use Cases", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-14 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-headline-md text-headline-md text-on-surface tracking-tight">
              VervAI
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={
                  isActive(link.href)
                    ? "transition-colors text-primary font-body-medium"
                    : "font-body-medium text-body-medium text-on-surface-variant hover:text-on-surface transition-colors"
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="hidden sm:inline font-body-medium text-body-medium text-on-surface-variant hover:text-on-surface px-3 py-1.5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="hidden sm:inline-flex h-10 px-5 rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm flex items-center justify-center hover:bg-primary transition-all active:scale-[0.98]"
          >
            Start Free Trial
          </Link>
          <button
            aria-label="Toggle navigation"
            aria-expanded={open}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            type="button"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? "close" : "menu"} size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="md:hidden border-t border-outline-variant/50 bg-surface/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg font-body-medium text-body-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-primary-fixed/40 text-primary font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
                onClick={() => setOpen(false)}
              >
                <span>{link.label}</span>
                <Icon name="chevron_right" size={16} className="text-outline" />
              </Link>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-outline-variant/50">
              <Link
                href="/sign-in"
                className="h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm flex items-center justify-center hover:bg-surface-container transition-colors"
                onClick={() => setOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="h-10 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center hover:bg-primary-container transition-all"
                onClick={() => setOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}