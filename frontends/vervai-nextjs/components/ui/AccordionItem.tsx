"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Icon from "./Icon";

type AccordionItemProps = {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export default function AccordionItem({
  title,
  children,
  defaultOpen = false,
  onOpenChange,
  className = "",
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div
      className={`bg-surface-container-low rounded-lg overflow-hidden ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-space-md py-space-sm text-left hover:bg-surface-container transition-colors"
      >
        <span className="font-headline-sm text-headline-sm text-on-surface flex-1">
          {title}
        </span>
        <Icon
          name="expand_more"
          size={20}
          className={`text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="px-space-md pb-space-md text-on-surface-variant font-body-medium text-body-medium leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}