import type { ReactNode } from "react";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || required) && (
        <label htmlFor={htmlFor} className="font-caption-bold text-caption-bold text-on-surface">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
      {!error && hint && (
        <p className="font-body-sm text-body-sm text-secondary">{hint}</p>
      )}
    </div>
  );
}