type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

/** Material Symbols icon (font). Matches the original prototype's icon system. */
export default function Icon({ name, size = 18, className = "" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined shrink-0 ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}