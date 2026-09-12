import { createClient } from "@/lib/supabase/server";
import { getProfile, getConnectionsState } from "@/lib/data";
import AccountHeader from "@/components/account/AccountHeader";
import ProfileSection from "@/components/account/ProfileSection";
import ActiveSessions from "@/components/account/ActiveSessions";
import AuthMethods from "@/components/account/AuthMethods";
import ConnectedAccounts from "@/components/account/ConnectedAccounts";
import DangerZone from "@/components/account/DangerZone";

function metadataName(user: { user_metadata?: unknown } | null): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = typeof meta.full_name === "string" ? meta.full_name : null;
  const name = typeof meta.name === "string" ? meta.name : null;
  return full ?? name;
}

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user ?? null;

  const [profile, connections] = await Promise.all([
    getProfile(),
    getConnectionsState(),
  ]);

  const email = user?.email ?? null;
  const name = metadataName(user);
  const userId = user?.id ?? null;

  return (
    <>
      <div className="flex flex-col w-full">
        <div className="px-space-xl py-space-lg max-w-[1400px] w-full mx-auto flex flex-col gap-space-xl">
          <AccountHeader
            email={email}
            name={name}
            plan={profile?.plan ?? null}
            planStatus={profile?.plan_status ?? null}
          />
          <div className="grid grid-cols-12 gap-5">
            <ProfileSection
              email={email}
              name={name}
              plan={profile?.plan ?? null}
              planStatus={profile?.plan_status ?? null}
              userId={userId}
            />
            <ActiveSessions email={email} />
            <AuthMethods />
            <ConnectedAccounts connections={connections} />
            <DangerZone />
          </div>
        </div>
      </div>
    </>
  );
}