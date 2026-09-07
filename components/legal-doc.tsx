// Server component that frames a plain-language legal page (Terms / Privacy).
// These are MVP policy pages written in plain English — NOT legal advice; have
// a lawyer review before a public launch. Replace CONTACT_EMAIL (in each page)
// with a real address before sharing the URL.
import Link from "next/link";

export default function LegalDoc({
  title,
  updated,
  children
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto w-full max-w-2xl px-4">
        <Link href="/" className="text-sm font-medium text-primary-500 hover:underline">
          ← Back to home
        </Link>
        <h1 className="mt-8 font-display text-3xl font-bold text-theme-text-primary">
          {title}
        </h1>
        <p className="mt-1 text-sm text-theme-text-secondary">Last updated: {updated}</p>
        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-theme-text-primary">
          {children}
        </div>
      </div>
    </main>
  );
}

export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-semibold">{children}</h2>;
}