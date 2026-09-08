import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPrompts } from "@/lib/prompts";
import AppShell from "@/components/app-shell";
import BrandingForm from "@/components/branding-form";

export default async function BrandingPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Missing/misbehaving prompt table degrades to the built-in defaults rather
  // than erroring the whole page.
  let prompts = {};
  try {
    prompts = await getUserPrompts(user.id);
  } catch {
    prompts = {};
  }

  return (
    <AppShell>
      <BrandingForm initial={prompts} />
    </AppShell>
  );
}