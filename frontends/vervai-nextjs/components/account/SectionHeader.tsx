type SectionHeaderProps = {
  icon: string;
  iconClass: string;
  title: string;
  subtitle: string;
  badge?: { label: string; className: string };
};

export default function SectionHeader({ icon, iconClass, title, subtitle, badge }: SectionHeaderProps) {
  return (
    <div className="px-space-lg py-4 bg-surface-container-low flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${iconClass}`}>{icon}</span>
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <p className="font-body-sm text-[12px] text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      {badge && <span className={badge.className}>{badge.label}</span>}
    </div>
  );
}