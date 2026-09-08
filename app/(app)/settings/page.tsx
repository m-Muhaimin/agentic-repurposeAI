import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/page-header";
import SettingsForm from "@/components/settings-form";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const meta = user!.user_metadata as Record<string, unknown> | undefined;
  const name = typeof meta?.name === "string" ? meta.name : "";

  return (
      <div className="workspace py-8 lg:py-10">
        <PageHeader title="Settings" description="Manage your account and preferences." />
        <SettingsForm email={user!.email ?? ""} name={name} />
      </div>
  );
}