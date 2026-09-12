"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Icon from "./Icon";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${
          size === "sm" ? "max-w-sm" : "max-w-lg"
        } bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-space-lg py-4 border-b border-outline-variant/40">
          <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="px-space-lg py-space-lg max-h-[60vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-space-sm px-space-lg py-4 border-t border-outline-variant/40 bg-surface-container-low">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}