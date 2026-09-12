import SectionHeader from "@/components/account/SectionHeader";
import Icon from "@/components/ui/Icon";

type ActiveSessionsProps = {
  email?: string | null;
};

export default function ActiveSessions({ email }: ActiveSessionsProps) {
  return (
    <section className="col-span-12 lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
      <SectionHeader
        icon="devices"
        iconClass="text-secondary"
        title="Active Sessions & Devices"
        subtitle="The current authenticated browser session"
        badge={{
          label: "1 Active",
          className:
            "inline-flex items-center gap-1 text-[11px] font-caption-bold text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded",
        }}
      />
      <div className="p-space-lg flex flex-col gap-space-md">
        <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <div className="p-2 bg-primary-fixed rounded-lg text-on-primary-fixed">
              <Icon name="laptop_mac" size={22} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-[14px] text-on-surface">Current Web Session</span>
                <span className="bg-primary text-on-primary text-[10px] font-caption-bold px-1.5 py-0.5 rounded">
                  Current Session
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Signed in via this browser</span>
              <span className="font-body-sm text-[11px] text-secondary font-mono">
                {email ?? "Signed-in session"}
              </span>
            </div>
          </div>
          <Icon name="verified_user" size={18} className="text-tertiary" />
        </div>
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Other devices and sessions are not enumerated here.
        </span>
      </div>
    </section>
  );
}