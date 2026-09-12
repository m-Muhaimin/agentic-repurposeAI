"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Icon from "./Icon";

type DropdownItem = {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
  onSelect?: () => void;
};

type DropdownMenuProps = {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  disabled?: boolean;
  className?: string;
};

export default function DropdownMenu({
  trigger,
  items,
  align = "right",
  disabled,
  className = "",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, items.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      }
      if (e.key === "Enter" && items[highlighted]) {
        e.preventDefault();
        items[highlighted].onSelect?.();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, items, highlighted]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <div
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={disabled}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) setOpen((o) => !o);
          }
        }}
        className={disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 min-w-[160px] bg-surface-container-lowest border border-outline-variant/40 rounded-lg shadow-lg py-1 z-50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left font-body-sm text-body-sm transition-colors ${
                highlighted === i
                  ? "bg-surface-container text-on-surface"
                  : "text-on-surface-variant"
              } ${item.danger ? "text-error hover:bg-error-container" : ""}`}
            >
              {item.icon && <Icon name={item.icon} size={16} />}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}