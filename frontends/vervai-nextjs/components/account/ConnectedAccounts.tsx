import SectionHeader from "@/components/account/SectionHeader";
import { formatDate, type ConnectionsState } from "@/lib/data";

type ConnectedAccountsProps = {
  connections: ConnectionsState;
};

type ConnectedAccountRow = {
  letter: string;
  letterClass: string;
  title: string;
  detail: string;
  connectedAt: string | null;
};

function buildRows(connections: ConnectionsState): ConnectedAccountRow[] {
  const rows: ConnectedAccountRow[] = [];
  if (connections.buffer) {
    rows.push({
      letter: "B",
      letterClass: "text-primary",
      title: "Buffer",
      detail: `@${connections.buffer.username}`,
      connectedAt: connections.buffer.created_at,
    });
  }
  if (connections.youtube) {
    rows.push({
      letter: "YT",
      letterClass: "text-on-surface",
      title: "YouTube",
      detail: connections.youtube.channel_title,
      connectedAt: connections.youtube.created_at,
    });
  }
  if (connections.drive) {
    rows.push({
      letter: "GD",
      letterClass: "text-on-surface",
      title: "Google Drive",
      detail: `${connections.drive.drive_name}${connections.drive.drive_email ? ` · ${connections.drive.drive_email}` : ""}`,
      connectedAt: connections.drive.created_at,
    });
  }
  return rows;
}

export default function ConnectedAccounts({ connections }: ConnectedAccountsProps) {
  const rows = buildRows(connections);

  return (
    <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between overflow-hidden">
      <SectionHeader
        icon="hub"
        iconClass="text-primary"
        title="Connected Author Accounts"
        subtitle="External content platforms linked to this workspace."
        badge={{
          label: `${rows.length} Connected`,
          className: "font-caption-bold text-caption-bold bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded",
        }}
      />
      <div className="p-space-lg flex flex-col gap-space-md">
        {rows.length > 0 ? (
          rows.map((account) => (
            <div
              key={account.title}
              className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg"
            >
              <div className="flex items-center gap-space-sm">
                <div
                  className={`w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center font-headline-sm ${account.letterClass}`}
                >
                  {account.letter}
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-[14px] text-on-surface">{account.title}</span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">{account.detail}</span>
                  {account.connectedAt && (
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      Connected {formatDate(account.connectedAt)}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-caption-bold text-[11px] px-2 py-0.5 rounded bg-tertiary-fixed/30 text-tertiary">
                Connected
              </span>
            </div>
          ))
        ) : (
          <div className="p-space-sm bg-surface-container-low rounded-lg flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">link</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-[14px] text-on-surface">No connected accounts</span>
              <span className="font-body-sm text-[12px] text-on-surface-variant">
                Connect Buffer, YouTube, or Drive to syndicate your outputs.
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="px-space-lg py-3 bg-surface-container-low flex items-center justify-between">
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          {rows.length > 0 ? "Connected platforms shown from live connection state." : "No platforms linked to this workspace yet."}
        </span>
        {rows.length === 0 && (
          <button
            className="flex items-center gap-1.5 bg-surface-container-highest hover:bg-surface-dim text-on-surface font-caption-bold text-caption-bold px-3 py-1.5 rounded-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            <span className="material-symbols-outlined text-[16px]">add_link</span>
            <span>Link Platform</span>
          </button>
        )}
      </div>
    </section>
  );
}