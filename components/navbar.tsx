"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./logo";

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Outputs", href: "/#outputs" },
  { label: "Pricing", href: "/#pricing" }
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-theme-divider bg-neutral-100/90 backdrop-blur">
      <nav className="container flex h-16 items-center justify-between" aria-label="Main">
        <Logo />

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <Link href={link.href} className="nav-link">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-text-primary hidden sm:inline-flex">
            Log in
          </Link>
          <Link href="/upload" className="btn btn-primary">
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="nav-link lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
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
              {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-nav" className="border-t border-theme-divider bg-neutral-100 lg:hidden">
          <nav className="container flex flex-col gap-1 py-3" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="nav-link sm:hidden" onClick={() => setOpen(false)}>
              Log in
            </Link>
            <Link href="/upload" className="btn btn-primary mt-1 sm:hidden" onClick={() => setOpen(false)}>
              Get started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}