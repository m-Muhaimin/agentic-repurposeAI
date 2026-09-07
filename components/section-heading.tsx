import { clsx } from "clsx";

type Align = "center" | "left";

type SectionHeadingProps = {
  kicker: string;
  title: string;
  body?: string;
  align?: Align;
  variant?: "default" | "inverse";
  className?: string;
};

export function SectionHeading({
  kicker,
  title,
  body,
  align = "center",
  variant = "default",
  className
}: SectionHeadingProps) {
  const headingBase =
    "mt-4 font-display text-[32px] leading-[1.222] tracking-[-0.25px] md:text-[42px] md:leading-[1.156]";

  const inverse = variant === "inverse";

  return (
    <div
      className={clsx(
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        inverse ? "text-white" : "text-theme-text-primary",
        className
      )}
    >
      <span
        className={clsx(
          "badge",
          inverse
            ? "bg-white/10 text-white"
            : "bg-primary-100 text-primary-500"
        )}
      >
        <span className="inline-block animate-fade-in">{kicker}</span>
      </span>
      <h2 className={clsx(headingBase, inverse && "text-white")}>{title}</h2>
      {body && (
        <p
          className={clsx(
            "mt-4 text-base leading-normal",
            inverse ? "text-white/80" : "text-theme-text-secondary"
          )}
        >
          {body}
        </p>
      )}
    </div>
  );
}
