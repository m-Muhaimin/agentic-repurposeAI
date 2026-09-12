/* eslint-disable @next/next/no-img-element */

import ApproveScheduleButton from "./ApproveScheduleButton";

export type ApprovalPreview =
  | { kind: "image"; src: string; alt: string; text: string }
  | { kind: "document"; icon: string; text: string }
  | { kind: "video"; src: string; alt: string; text: string; audio: string };

export type ApprovalCardItem = {
  channel: string;
  channelTone: "blue" | "orange" | "red";
  channelIcon: string;
  channelMeta: string;
  title: string;
  slot: string;
  slotTone: "primary" | "neutral";
  slotHint: string;
  preview: ApprovalPreview;
  validation: { icon: string; label: string };
  secondaryAction: string;
  secondaryActionIcon?: string;
  jobId: string;
  scheduledAt?: string | null;
};

const TONE = {
  blue: {
    tile: "bg-blue-100 text-blue-800",
    badge: "bg-blue-50 text-blue-900",
    dot: "bg-blue-600",
    label: "text-blue-800",
  },
  orange: {
    tile: "bg-orange-100 text-orange-800",
    badge: "bg-orange-50 text-orange-900",
    dot: "bg-orange-600",
    label: "text-orange-800",
  },
  red: {
    tile: "bg-red-100 text-red-800",
    badge: "bg-red-50 text-red-900",
    dot: "bg-red-600",
    label: "text-red-800",
  },
} as const;

function Preview({ preview }: { preview: ApprovalPreview }) {
  if (preview.kind === "image") {
    return (
      <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-lowest">
        <img className="w-14 h-14 rounded object-cover shrink-0" src={preview.src} alt={preview.alt} />
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
          {preview.text}
        </p>
      </div>
    );
  }
  if (preview.kind === "document") {
    return (
      <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-lowest">
        <div className="w-14 h-14 rounded bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
          <span className="material-symbols-outlined text-[24px]">{preview.icon}</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
          {preview.text}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-lowest">
      <div className="relative w-14 h-14 rounded overflow-hidden shrink-0">
        <img className="w-full h-full object-cover" src={preview.src} alt={preview.alt} />
        <div className="absolute inset-0 bg-on-surface/30 flex items-center justify-center text-white">
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{preview.text}</p>
        <p className="font-label-caps text-label-caps text-secondary">{preview.audio}</p>
      </div>
    </div>
  );
}

export default function ApprovalCard({ item }: { item: ApprovalCardItem }) {
  const tone = TONE[item.channelTone];
  return (
    <article className="p-space-md rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low transition-all space-y-space-md shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${tone.tile} flex items-center justify-center shrink-0 mt-0.5`}
          >
            <span className="material-symbols-outlined text-[20px]">{item.channelIcon}</span>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded ${tone.badge}`}>
                {item.channel}
              </span>
              <span className="font-caption-bold text-caption-bold text-secondary flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`}></span>
                {item.channelMeta}
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface leading-snug">
              {item.title}
            </h3>
          </div>
        </div>
        <div className="sm:text-right shrink-0">
          <div className="font-label-caps text-label-caps text-secondary uppercase">
            Recommended Slot
          </div>
          <div
            className={`font-caption-bold text-caption-bold ${
              item.slotTone === "primary" ? "text-primary" : "text-on-surface"
            } flex sm:justify-end items-center gap-1`}
          >
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {item.slot}
          </div>
          <span className="text-[11px] font-body-sm text-secondary">{item.slotHint}</span>
        </div>
      </div>
      <Preview preview={item.preview} />
      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex items-center gap-2 text-secondary font-body-sm text-body-sm">
          <span className="material-symbols-outlined text-[16px] text-tertiary">
            {item.validation.icon}
          </span>
          <span>{item.validation.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded bg-surface-container text-on-surface font-caption-bold text-caption-bold hover:bg-surface-container-high transition-colors active:scale-[0.98] inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled
            title="Coming soon"
          >
            {item.secondaryActionIcon ? (
              <span className="material-symbols-outlined text-[16px]">
                {item.secondaryActionIcon}
              </span>
            ) : null}
            {item.secondaryAction}
          </button>
          <ApproveScheduleButton
            jobId={item.jobId}
            title={item.title}
            scheduledAt={item.scheduledAt}
          />
        </div>
      </div>
    </article>
  );
}