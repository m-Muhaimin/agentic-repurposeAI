import { clsx } from "clsx";
import { statusLabel, statusStyle } from "@/lib/status";

export default function StatusBadge({
  status,
  className
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={clsx("badge", statusStyle(status), className)}>
      {statusLabel(status)}
    </span>
  );
}