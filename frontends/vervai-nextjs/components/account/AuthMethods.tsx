import SectionHeader from "@/components/account/SectionHeader";

type AuthMethodRow = {
  icon: string;
  iconTile: string;
  title: string;
  detail: string;
};

const AUTH_METHODS: AuthMethodRow[] = [
  {
    icon: "vibration",
    iconTile: "p-2 bg-surface-container-high text-on-surface-variant rounded-lg",
    title: "Authenticator App (TOTP)",
    detail: "Not configured",
  },
  {
    icon: "pin",
    iconTile: "p-2 bg-surface-container-high text-on-surface-variant rounded-lg",
    title: "SMS / Email One-Time Codes",
    detail: "Not configured",
  },
  {
    icon: "fingerprint",
    iconTile: "p-2 bg-surface-container-high text-on-surface-variant rounded-lg",
    title: "Passkeys & WebAuthn",
    detail: "Not configured",
  },
];

export default function AuthMethods() {
  return (
    <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
      <SectionHeader
        icon="security"
        iconClass="text-tertiary"
        title="Two-Factor & Cryptographic Auth"
        subtitle="Additional sign-in methods available on this account."
      />
      <div className="p-space-lg flex flex-col gap-space-md">
        {AUTH_METHODS.map((method) => (
          <div
            key={method.title}
            className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg"
          >
            <div className="flex items-center gap-space-sm">
              <div className={method.iconTile}>
                <span className="material-symbols-outlined text-[20px]">{method.icon}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-[14px] text-on-surface">{method.title}</span>
                <span className="font-body-sm text-[12px] text-on-surface-variant">{method.detail}</span>
              </div>
            </div>
            <span className="font-caption-bold text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
              Not configured
            </span>
          </div>
        ))}
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Two-factor methods are managed through your authentication provider.
        </span>
      </div>
    </section>
  );
}