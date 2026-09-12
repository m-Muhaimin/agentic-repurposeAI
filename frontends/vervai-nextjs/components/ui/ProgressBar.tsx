export default function ProgressBar({
  value = 0,
  className = "",
  barClassName = "",
}: {
  value?: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div
      className={`w-full h-2 rounded-full bg-surface-container-highest overflow-hidden ${className}`}
    >
      <div
        className={`h-full bg-primary rounded-full transition-all duration-500 ${barClassName}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}