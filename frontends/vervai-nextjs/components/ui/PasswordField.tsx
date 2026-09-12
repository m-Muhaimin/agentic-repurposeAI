"use client";

import { useState } from "react";
import Icon from "./Icon";
import TextInput from "./TextInput";
import type { InputHTMLAttributes } from "react";

type PasswordFieldProps = {
  invalid?: boolean;
  leadingIcon?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordField({
  invalid,
  leadingIcon,
  className,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      type={visible ? "text" : "password"}
      invalid={invalid}
      leadingIcon={leadingIcon}
      className={className}
      trailing={
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="text-outline hover:text-on-surface transition-colors"
        >
          <Icon name={visible ? "visibility_off" : "visibility"} size={18} />
        </button>
      }
      {...rest}
    />
  );
}