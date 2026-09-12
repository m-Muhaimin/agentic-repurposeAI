import Icon from "./Icon";

function initialsFor(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  return (
    parts
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function Avatar({
  src,
  name,
  size = 32,
  className = "",
}: {
  src: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  if (!src) {
    const initials = name ? initialsFor(name) : null;
    return (
      <span
        aria-label={name || "avatar"}
        className={`inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container font-caption-bold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials ?? <Icon name="person" size={size * 0.6} />}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name || "avatar"}
      className={`rounded-full object-cover shrink-0 ring-1 ring-outline-variant/40 ${className}`}
      src={src}
      style={{ width: size, height: size }}
    />
  );
}