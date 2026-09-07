import { clsx } from "clsx";

// Marketing section intro — kicker badge, display headline, optional body.
// Alignment and spacing are props so sections keep their own rhythm.
export function SectionHeading({
  kicker,
  title,
  body,
  align = "center",
  className
}: {
  kicker: string;
  title: string;
  body?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={clsx(
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className
      )}
    >
      <span className="badge bg-primary-100 text-primary-500">{kicker}</span>
      <h2 className="mt-4 font-display text-[32px] leading-[1.222] tracking-[-0.25px] md:text-[42px] md:leading-[1.156]">
        {title}
      </h2>
      {body && <p className="mt-4 text-base leading-normal text-theme-text-secondary">{body}</p>}
    </div>
  );
}