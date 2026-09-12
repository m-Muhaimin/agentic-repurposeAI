import type { ReactNode } from "react";

export type NotificationChip = { icon: string; iconClass: string; label: string };
export type NotificationButton = { label: string; icon?: string; iconClass?: string; iconAfter?: boolean; className: string };

export type NotificationBody =
  | { type: "chips"; chips: NotificationChip[] }
  | { type: "slide"; number: string; title: string; meta: string }
  | { type: "progress"; barClass: string; used: string; limit: string }
  | { type: "wave" }
  | { type: "none" };

export type NotificationFooter =
  | { type: "actions"; wrapperClass: string; buttons: NotificationButton[]; trailing?: ReactNode }
  | { type: "error"; wrapperClass: string; button: NotificationButton; status: ReactNode }
  | { type: "quota"; wrapperClass: string; button: NotificationButton; tier: string }
  | { type: "wave"; wrapperClass: string; persona: string; link: string };

export type NotificationCardProps = {
  category: string;
  barClass: string;
  icon: string;
  iconClass: string;
  title: string;
  badge?: { label: string; className: string };
  time?: string;
  description: ReactNode;
  body?: NotificationBody;
  footer: NotificationFooter;
};

function renderBody(body: NotificationBody) {
  switch (body.type) {
    case "chips":
      return (
        <div className="grid grid-cols-2 gap-space-xs mb-space-md">
          {body.chips.map((chip) => (
            <div key={chip.label} className="bg-surface-container-low p-space-xs rounded-lg flex items-center gap-space-xs">
              <span className={`material-symbols-outlined text-[16px] ${chip.iconClass}`}>{chip.icon}</span>
              <span className="font-caption-bold text-caption-bold text-on-surface truncate">{chip.label}</span>
            </div>
          ))}
        </div>
      );
    case "slide":
      return (
        <div className="flex items-center gap-space-sm p-space-xs bg-surface-container-low rounded-lg mb-space-md">
          <div className="w-10 h-10 rounded bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 font-headline-sm text-headline-sm">
            {body.number}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-caption-bold text-caption-bold text-on-surface truncate">{body.title}</span>
            <span className="font-body-sm text-[11px] text-on-surface-variant">{body.meta}</span>
          </div>
        </div>
      );
    case "progress":
      return (
        <div className="space-y-1.5 mb-space-md">
          <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden flex">
            <div className={body.barClass}></div>
          </div>
          <div className="flex justify-between font-caption-bold text-[10px] text-on-surface-variant">
            <span>{body.used}</span>
            <span>{body.limit}</span>
          </div>
        </div>
      );
    case "wave":
      return (
        <div className="h-10 bg-surface-container-low rounded-lg p-space-xs flex items-center justify-center overflow-hidden mb-space-xs">
          <svg className="w-full h-8 text-tertiary" fill="none" preserveAspectRatio="none" viewBox="0 0 300 40">
            <path d="M0,20 Q30,5 60,20 T120,20 T180,20 T240,20 T300,20" fill="none" opacity="0.4" stroke="currentColor" strokeWidth="2"></path>
            <path d="M0,20 Q25,8 55,20 T115,22 T175,18 T235,21 T300,20" fill="none" stroke="currentColor" strokeWidth="2.5"></path>
          </svg>
        </div>
      );
    case "none":
      return null;
  }
}

function renderFooter(footer: NotificationFooter) {
  switch (footer.type) {
    case "actions":
      return (
        <div className={footer.wrapperClass}>
          <div className="flex items-center gap-space-xs">
            {footer.buttons.map((button) => (
              <button key={button.label} className={button.className} type="button">
                {button.icon && !button.iconAfter && (
                  <span className={`material-symbols-outlined text-[16px] ${button.iconClass ?? ""}`}>{button.icon}</span>
                )}
                <span>{button.label}</span>
                {button.icon && button.iconAfter && (
                  <span className={`material-symbols-outlined text-[16px] ${button.iconClass ?? ""}`}>{button.icon}</span>
                )}
              </button>
            ))}
          </div>
          {footer.trailing}
        </div>
      );
    case "error":
      return (
        <div className={footer.wrapperClass}>
          <button className={footer.button.className} type="button">
            {footer.button.icon && (
              <span className={`material-symbols-outlined text-[16px] ${footer.button.iconClass ?? ""}`}>{footer.button.icon}</span>
            )}
            <span>{footer.button.label}</span>
          </button>
          {footer.status}
        </div>
      );
    case "quota":
      return (
        <div className={footer.wrapperClass}>
          <button className={footer.button.className} type="button">
            {footer.button.icon && (
              <span className={`material-symbols-outlined text-[16px] ${footer.button.iconClass ?? ""}`}>{footer.button.icon}</span>
            )}
            <span>{footer.button.label}</span>
          </button>
          <span className="font-caption-bold text-[11px] text-on-surface-variant">{footer.tier}</span>
        </div>
      );
    case "wave":
      return (
        <div className={footer.wrapperClass}>
          <span>{footer.persona}</span>
          <span className="text-primary hover:underline cursor-pointer">{footer.link}</span>
        </div>
      );
  }
}

export default function NotificationCard({ category, barClass, icon, iconClass, title, badge, time, description, body, footer }: NotificationCardProps) {
  return (
    <div
      className="notification-card bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
      data-category={category}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`}></div>
      <div className="flex items-start justify-between gap-space-sm mb-space-xs">
        <div className="flex items-center gap-space-xs">
          <span className={`material-symbols-outlined text-[18px] ${iconClass}`}>{icon}</span>
          <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {badge && <span className={badge.className}>{badge.label}</span>}
          {time && <span className="font-caption-bold text-[10px] text-on-surface-variant">{time}</span>}
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm leading-relaxed">{description}</p>
      {body && body.type !== "none" && renderBody(body)}
      {renderFooter(footer)}
    </div>
  );
}