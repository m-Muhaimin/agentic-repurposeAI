"use client";

import { forwardRef } from "react";
import Icon from "./Icon";
import type { InputHTMLAttributes, ReactNode } from "react";

type TextInputProps = {
  leadingIcon?: string;
  trailing?: ReactNode;
  invalid?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ leadingIcon, trailing, invalid, className = "", disabled, ...rest }, ref) => {
    return (
      <div className={`relative flex items-center ${className}`}>
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            size={18}
            className="text-outline absolute left-3 pointer-events-none"
          />
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full h-9 ${
            leadingIcon ? "pl-9" : "pl-3"
          } pr-3 rounded bg-surface-container-lowest border text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none transition-colors ${
            invalid
              ? "border-error text-error focus:border-error"
              : "border-outline-variant/50 focus:border-primary"
          } ${disabled ? "opacity-40 pointer-events-none" : ""}`}
          {...rest}
        />
        {trailing && (
          <div className="absolute right-3 flex items-center">{trailing}</div>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
export default TextInput;