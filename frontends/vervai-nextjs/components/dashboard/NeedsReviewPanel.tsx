import Link from "next/link";
import Panel from "@/components/ui/Panel";
import Icon from "@/components/ui/Icon";
import Tag, { type TagTone } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";

export type Review = {
  channel: string;
  channelTone: TagTone;
  match?: string;
  matchIcon?: string;
  title: string;
  meta: string;
};

function ReviewRow({ review }: { review: Review }) {
  return (
    <div className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between gap-space-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <Tag tone={review.channelTone}>{review.channel}</Tag>
          {review.match && (
            <span className="font-caption-bold text-[11px] text-tertiary flex items-center gap-0.5">
              {review.matchIcon && <Icon name={review.matchIcon} size={13} />} {review.match}
            </span>
          )}
        </div>
        <p className="font-headline-sm text-headline-sm text-on-surface truncate leading-snug">
          {review.title}
        </p>
        <p className="font-body-sm text-body-sm text-secondary text-xs truncate">{review.meta}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0 bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary shadow-sm text-xs"
        disabled
        title="Coming soon"
      >
        Review
      </Button>
    </div>
  );
}

export default function NeedsReviewPanel({
  reviews,
}: {
  reviews: Review[];
}) {
  return (
    <Panel className="lg:col-span-5">
      <div>
        <div className="flex items-center justify-between pb-space-sm mb-space-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Needs Review</h2>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-caption-bold text-caption-bold text-xs">
              {reviews.length} {reviews.length === 1 ? "Draft" : "Drafts"}
            </span>
          </div>
          <Icon name="pending_actions" size={20} className="text-outline" />
        </div>
        <p className="font-body-sm text-body-sm text-secondary mb-space-md">
          Generated drafts requiring human editorial approval before delivery.
        </p>
        {reviews.length > 0 ? (
          <div className="space-y-space-sm">
            {reviews.map((review) => (
              <ReviewRow key={review.title} review={review} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            Nothing awaiting review — the queue is clear.
          </div>
        )}
      </div>
      <div className="pt-space-md mt-space-sm">
        <Link
          href="/library"
          className="flex items-center justify-between text-primary font-caption-bold text-caption-bold text-sm hover:text-primary-container group transition-colors"
        >
          <span>Go to review queue</span>
          <Icon name="arrow_forward" size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </Panel>
  );
}