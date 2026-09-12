import AppShell from "@/components/shell/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | undefined;
  let userName: string | undefined;
  let planLabel: string | undefined;

  try {
    const supabase = await createClient();
    const [{ data }, profile] = await Promise.all([supabase.auth.getUser(), getProfile()]);
    userEmail = data.user?.email ?? undefined;
    userName =
      typeof data.user?.user_metadata?.full_name === "string"
        ? data.user.user_metadata.full_name
        : undefined;
    planLabel = profile?.plan ?? undefined;
  } catch {
    // Unauthenticated or transient error: render a neutral shell.
  }

  return (
    <AppShell userEmail={userEmail} userName={userName} planLabel={planLabel}>
      {children}
    </AppShell>
  );
}