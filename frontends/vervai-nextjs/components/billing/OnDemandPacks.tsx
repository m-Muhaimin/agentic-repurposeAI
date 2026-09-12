type Pack = {
  icon: string;
  iconClass: string;
  title: string;
  description: string;
  price: string;
  priceClass: string;
  bestValue?: boolean;
};

const PACKS: Pack[] = [
  {
    icon: "bolt",
    iconClass: "bg-primary-fixed text-on-primary-fixed",
    title: "+10 Synthesis Credits",
    description: "High-depth batch model runs",
    price: "$49",
    priceClass: "bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary text-on-surface",
  },
  {
    icon: "auto_awesome",
    iconClass: "bg-primary-container text-on-primary shadow-sm",
    title: "+25 Synthesis Credits",
    description: "Maximum unit rate savings (20% off)",
    price: "$99",
    priceClass: "bg-primary-container text-on-primary hover:bg-primary",
    bestValue: true,
  },
  {
    icon: "graphic_eq",
    iconClass: "bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed",
    title: "+10 Hours Audio Ingestion",
    description: "Whisper long-form diarization pool",
    price: "$39",
    priceClass: "bg-surface-container-lowest hover:bg-secondary text-on-surface hover:text-on-secondary",
  },
];

export default function OnDemandPacks() {
  return (
    <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">On-Demand Packs</h2>
          <span className="font-caption-bold text-caption-bold text-on-secondary-fixed bg-secondary-fixed px-2 py-0.5 rounded">
            No Expire
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Instant top-ups without stepping up subscription tier. Added directly to the active
          workspace reserve.
        </p>
        <div className="flex flex-col gap-space-sm mt-space-xs">
          {PACKS.map((pack) => (
            <div
              key={pack.title}
              className="group flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer relative overflow-hidden"
            >
              {pack.bestValue ? (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container"></div>
              ) : null}
              <div className={`flex items-center gap-space-sm ${pack.bestValue ? "pl-1" : ""}`}>
                <div className={`w-8 h-8 rounded ${pack.iconClass}`}>
                  <span className="material-symbols-outlined text-[18px]">{pack.icon}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {pack.title}
                    </span>
                    {pack.bestValue ? (
                      <span className="font-caption-bold text-[9px] uppercase px-1 rounded bg-tertiary-fixed text-on-tertiary-fixed">
                        Best Value
                      </span>
                    ) : null}
                  </div>
                  <span className="font-body-sm text-[11px] text-on-surface-variant leading-tight">
                    {pack.description}
                  </span>
                </div>
              </div>
              <button
                className={`font-headline-sm text-headline-sm px-space-sm py-1.5 rounded shadow-sm transition-colors text-right ${pack.priceClass}`}
                type="button"
              >
                {pack.price}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-space-md pt-space-xs flex items-center justify-between text-on-surface-variant font-caption-bold text-caption-bold">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
          Secured by Stripe
        </span>
        <span className="text-primary cursor-pointer hover:underline">
          Custom Enterprise Allotment?
        </span>
      </div>
    </div>
  );
}