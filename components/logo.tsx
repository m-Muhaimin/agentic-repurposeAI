import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <Image
      src="/icon.png"
      alt="VervAI"
      width={512}
      height={512}
      className={`shrink-0 ${className}`}
      priority
    />
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <BrandMark />
      <span className="font-display text-lg font-bold tracking-tight text-theme-text-primary">
        {BRAND.name}
      </span>
    </Link>
  );
}