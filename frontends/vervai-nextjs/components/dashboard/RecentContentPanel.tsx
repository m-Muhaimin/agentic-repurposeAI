import Link from "next/link";
import Panel from "@/components/ui/Panel";
import Tag, { type TagTone } from "@/components/ui/Tag";

export type ContentItem = {
  label: string;
  labelTone: TagTone;
  image: string | null;
  imageAlt: string;
  title: string;
  meta: string;
  status: string;
  statusTone: "neutral" | "brand" | "primary";
};

const CONTENTS: ContentItem[] = [];

function ContentTile({ item }: { item: ContentItem }) {
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container flex flex-col justify-between transition-colors">
      <div className="aspect-video w-full rounded bg-surface-container-highest overflow-hidden mb-2 relative flex items-center justify-center">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="w-full h-full object-cover" src={item.image} alt={item.imageAlt} />
        ) : (
          <span className="material-symbols-outlined text-[28px] text-outline/50">
            auto_stories
          </span>
        )}
        <Tag tone={item.labelTone} className="absolute top-1.5 left-1.5 bg-surface-container-lowest/90 backdrop-blur-sm">
          {item.label}
        </Tag>
      </div>
      <div>
        <p className="font-caption-bold text-caption-bold text-on-surface truncate">{item.title}</p>
        <div className="flex items-center justify-between text-xs text-secondary mt-1">
          <span className="font-body-sm text-[11px]">{item.meta}</span>
          <Tag tone={item.statusTone}>{item.status}</Tag>
        </div>
      </div>
    </div>
  );
}

export default function RecentContentPanel({
  contents,
  total,
  updatedLabel,
}: {
  contents: ContentItem[];
  total: number;
  updatedLabel: string;
}) {
  return (
    <Panel className="lg:col-span-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-headline-lg text-headline-lg text-on-surface">Recent Content</h3>
          <Link
            href="/library"
            className="font-caption-bold text-caption-bold text-primary hover:text-primary-container flex items-center gap-1 transition-colors"
          >
            <span>View library</span>
          </Link>
        </div>
        <p className="font-body-medium text-body-medium text-secondary mb-space-md">
          Synthesized deliverables ready across your active communication channels.
        </p>
        {contents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
            {contents.map((item) => (
              <ContentTile key={item.title} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No generated content yet. Upload a source to start synthesizing.
          </div>
        )}
      </div>
      <div className="pt-space-md mt-space-sm flex items-center justify-between">
        <span className="font-body-sm text-body-sm text-secondary text-xs">
          Total {total} items indexed in workspace
        </span>
        <span className="font-caption-bold text-caption-bold text-xs text-on-surface">
          Updated {updatedLabel}
        </span>
      </div>
    </Panel>
  );
}