type FeatureCard = {
  icon: string;
  iconClass: string;
  title: string;
  description: string;
};

const FEATURES: FeatureCard[] = [
  {
    icon: "graphic_eq",
    iconClass: "text-tertiary",
    title: "Library Ingestion",
    description: "Bring in podcasts, videos, and transcripts as searchable sources.",
  },
  {
    icon: "auto_awesome",
    iconClass: "text-primary",
    title: "Agent Drafting",
    description: "Generate posts, newsletters, scripts, and threads from your sources.",
  },
  {
    icon: "fact_check",
    iconClass: "text-primary",
    title: "Review & Approve",
    description: "Keep a human in the loop before anything goes out.",
  },
  {
    icon: "send",
    iconClass: "text-secondary",
    title: "Scheduled Distribution",
    description: "Queue content and push it to your connected channels.",
  },
];

export default function FeatureCards() {
  return (
    <div className="space-y-4">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex items-start gap-3.5 p-3 rounded-lg bg-surface-container-lowest/80 shadow-sm">
          <span className={`material-symbols-outlined text-[20px] mt-0.5 ${feature.iconClass}`}>{feature.icon}</span>
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">{feature.title}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{feature.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}