import { BRAND } from "@/lib/brand";
import Link from "next/link";
import Logo from "./logo";
import WaitlistForm from "./waitlist-form";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Outputs", href: "/#outputs" },
      { label: "Pricing", href: "/#pricing" }
    ]
  },
  {
    heading: "App",
    links: [
      { label: "Overview", href: "/dashboard" },
      { label: "Content Library", href: "/library" },
      { label: "Create content", href: "/upload" },
      { label: "Log in", href: "/login" }
    ]
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" }
    ]
  }
];

const TRUST_BADGES = [
  { label: "SOC 2 coming", icon: "🔒" },
  { label: "GDPR ready", icon: "🇪🇺" },
  { label: "Data encrypted", icon: "🛡️" }
];

export default function Footer() {
  return (
    <footer className="border-t border-theme-divider bg-neutral-100">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-normal text-theme-text-secondary">
            {BRAND.tagline} Turn your recordings into a LinkedIn post, newsletter
            section, short-form script, thread, or carousel — all ready to edit.
          </p>
          <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary-100 px-3 py-1 text-[12px] font-semibold text-primary-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M12 3l1.9 5.7a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 1 1.3-1.3L12 3z" />
            </svg>
            Free during beta — your first 5 VervAI jobs are on us
          </p>

          <div className="mt-6">
            <WaitlistForm />
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className="caption mb-4 uppercase tracking-wider text-theme-text-secondary">
              {col.heading}
            </p>
            <ul className="flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm font-medium text-theme-text-primary transition-colors hover:text-primary-500"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-theme-divider">
        <div className="container flex flex-col items-center justify-between gap-4 py-5 text-sm text-theme-text-secondary sm:flex-row">
          <p>© 2026 VervAI</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span
              aria-label="Trust badges"
              className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            >
              {TRUST_BADGES.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 text-xs"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </span>
              ))}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/legal/privacy" className="transition-colors hover:text-theme-text-primary">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-theme-text-primary">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
