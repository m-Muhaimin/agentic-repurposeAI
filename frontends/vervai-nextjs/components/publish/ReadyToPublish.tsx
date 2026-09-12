import ApprovalCard, { type ApprovalCardItem } from "./ApprovalCard";

export default function ReadyToPublish({
  items,
  total,
}: {
  items: ApprovalCardItem[];
  total: number;
}) {
  return (
    <section className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col">
      <div className="p-space-lg bg-surface-container-low/40 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Ready to Publish</h2>
            <p className="font-label-caps text-label-caps text-secondary uppercase tracking-wider">
              Human Sign-off Required • {total} Awaiting Approval
            </p>
          </div>
        </div>
        <span className="font-caption-bold text-caption-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 shadow-xs">
          Pending Approval
        </span>
      </div>
      <div className="p-space-lg space-y-space-md">
        {items.length > 0 ? (
          items.map((item) => (
            <ApprovalCard key={item.title} item={item} />
          ))
        ) : (
          <div className="rounded-xl bg-surface-container-low p-space-lg text-center text-secondary font-body-sm text-body-sm">
            No drafts awaiting approval. Generated outputs will land here for sign-off.
          </div>
        )}
      </div>
    </section>
  );
}