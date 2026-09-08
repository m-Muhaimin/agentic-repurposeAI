import AppShell from "@/components/app-shell";

// Single nested layout owning the authenticated app shell. Route groups don't
// change URLs, so middleware.ts still guards every path individually; unauthed
// navigation is redirected to /login before this layout ever renders.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}