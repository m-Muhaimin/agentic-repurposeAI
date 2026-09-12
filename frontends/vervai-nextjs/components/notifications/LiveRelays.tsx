import type { ConnectionsState } from "@/lib/data";

type Channel = { key: "buffer" | "youtube" | "drive"; name: string; icon: string };

const CHANNELS: Channel[] = [
  { key: "buffer", name: "Buffer", icon: "send" },
  { key: "youtube", name: "YouTube", icon: "smart_display" },
  { key: "drive", name: "Drive", icon: "folder_open" },
];

function detailFor(connections: ConnectionsState, key: Channel["key"]): string {
  if (key === "buffer") return connections.buffer ? `@${connections.buffer.username}` : "No Buffer key";
  if (key === "youtube") return connections.youtube ? connections.youtube.channel_title : "No channel linked";
  return connections.drive ? connections.drive.drive_email : "No Drive account";
}

export default function LiveRelays({ connections }: { connections: ConnectionsState }) {
  const connected = (key: Channel["key"]) =>
    key === "buffer" ? Boolean(connections.buffer) : key === "youtube" ? Boolean(connections.youtube) : Boolean(connections.drive);

  return (
    <div className="p-space-lg bg-surface-container-lowest shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between mb-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">settings_input_component</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">Connected Channels</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-space-sm">
        {CHANNELS.map((channel) => (
          <div
            key={channel.key}
            className="bg-surface-container-low hover:bg-surface-container p-space-sm rounded-lg flex flex-col justify-between transition-colors"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className="flex items-center gap-1 font-caption-bold text-caption-bold text-on-surface">
                <span className="material-symbols-outlined text-[14px]">{channel.icon}</span>
                {channel.name}
              </span>
              <input checked={connected(channel.key)} readOnly className="accent-primary w-4 h-4 rounded cursor-default" type="checkbox" tabIndex={-1} />
            </div>
            <span className="font-body-sm text-[11px] text-on-surface-variant truncate" title={detailFor(connections, channel.key)}>
              {detailFor(connections, channel.key)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}