/* eslint-disable @next/next/no-img-element */

import DeleteOutputMenu from "@/components/library/DeleteOutputMenu";

export type ContentCardStatus =
  | { kind: "scheduled"; label: string }
  | { kind: "review"; label: string }
  | { kind: "ready"; label: string };

export type ContentCardPreview =
  | {
      kind: "image";
      src: string;
      alt: string;
      badge: string;
    }
  | {
      kind: "video";
      src: string;
      alt: string;
      duration: string;
      sync: string;
    }
  | {
      kind: "thread";
      authorInitials: string;
      authorName: string;
      authorHandle: string;
      tweetIndex: string;
      quote: string;
    };

export type ContentCardItem = {
  typeLabel: string;
  typeIcon: string;
  typeTone: "secondary" | "neutral";
  status: ContentCardStatus;
  preview: ContentCardPreview;
  title: string;
  description?: string;
  meta?: string;
  source: string;
  actionLabel: string;
  actionIcon: string;
  outputId?: string | null;
};

function StatusBadge({ status }: { status: ContentCardStatus }) {
  if (status.kind === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 font-caption-bold text-[11px] text-tertiary bg-emerald-50 px-2 py-0.5 rounded-full">
        <span className="material-symbols-outlined text-[12px]">event_available</span>
        <span>{status.label}</span>
      </span>
    );
  }
  if (status.kind === "review") {
    return (
      <span className="inline-flex items-center gap-1 font-caption-bold text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>{status.label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-caption-bold text-[11px] text-tertiary bg-emerald-50 px-2 py-0.5 rounded-full">
      <span className="material-symbols-outlined text-[12px]">verified</span>
      <span>{status.label}</span>
    </span>
  );
}

function TypeBadge({ item }: { item: ContentCardItem }) {
  const toneClass =
    item.typeTone === "secondary"
      ? "bg-secondary-fixed text-on-secondary-fixed"
      : "bg-surface-container text-on-surface";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-caption-bold px-2 py-0.5 rounded ${toneClass}`}
    >
      <span className="material-symbols-outlined text-[13px]">{item.typeIcon}</span>
      <span>{item.typeLabel}</span>
    </span>
  );
}

function Preview({ item }: { item: ContentCardItem }) {
  const preview = item.preview;
  if (preview.kind === "image") {
    return (
      <div className="relative w-full h-36 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center p-3">
        <img
          className="w-full h-full object-cover rounded shadow-xs"
          src={preview.src}
          alt={preview.alt}
        />
        <div className="absolute bottom-2 right-2 bg-on-background/80 backdrop-blur-xs text-surface-container-lowest px-1.5 py-0.5 rounded font-label-caps text-[10px]">
          {preview.badge}
        </div>
      </div>
    );
  }
  if (preview.kind === "video") {
    return (
      <div className="relative w-full h-36 rounded-lg bg-surface-container-high overflow-hidden group/video">
        <img className="w-full h-full object-cover" src={preview.src} alt={preview.alt} />
        <div className="absolute inset-0 bg-on-background/30 flex items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-surface-container-lowest/90 text-primary flex items-center justify-center shadow-md group-hover/video:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          </div>
        </div>
        <div className="absolute bottom-2 left-2 bg-on-background/80 backdrop-blur-xs text-surface-container-lowest px-1.5 py-0.5 rounded font-label-caps text-[10px]">
          {preview.duration}
        </div>
        <div className="absolute bottom-2 right-2 bg-surface-container-lowest text-on-surface px-1.5 py-0.5 rounded font-caption-bold text-[10px]">
          {preview.sync}
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-lg bg-surface-container-low space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center font-caption-bold text-[10px]">
          {preview.authorInitials}
        </div>
        <span className="font-caption-bold text-[12px] text-on-surface">{preview.authorName}</span>
        <span className="text-secondary text-[11px]">
          {preview.authorHandle} • {preview.tweetIndex}
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface italic">{`"${preview.quote}"`}</p>
    </div>
  );
}

export default function ContentCard({ item }: { item: ContentCardItem }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm hover:shadow-md transition-shadow group">
      <div className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <TypeBadge item={item} />
          <div className="flex items-center gap-1">
            <StatusBadge status={item.status} />
            {item.outputId ? (
              <DeleteOutputMenu outputId={item.outputId} title={item.title} />
            ) : null}
          </div>
        </div>
        <Preview item={item} />
        <div>
          <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
            {item.title}
          </h4>
          {item.description ? (
            <p className="font-body-sm text-body-sm text-secondary mt-1 line-clamp-2">
              {item.description}
            </p>
          ) : null}
          {item.meta ? (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="font-caption-bold text-caption-bold text-tertiary">{item.meta}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="pt-space-md mt-space-sm flex items-center justify-between">
        <span className="font-label-caps text-label-caps text-secondary uppercase">
          From: {item.source}
        </span>
        <button
          className="inline-flex items-center gap-1 text-primary font-caption-bold text-caption-bold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled
          title="Coming soon"
        >
          <span>{item.actionLabel}</span>
          <span className="material-symbols-outlined text-[16px]">{item.actionIcon}</span>
        </button>
      </div>
    </div>
  );
}