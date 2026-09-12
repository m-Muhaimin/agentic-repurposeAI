import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function AuthHeader() {
  return (
    <header className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
      <Link
        href="/"
        className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <Icon name="arrow_back" size={18} />
        <span>Back to verv.ai</span>
      </Link>
    </header>
  );
}