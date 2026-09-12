"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import TextInput from "./TextInput";

type SearchInputProps = {
  debounceMs?: number;
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function SearchInput({
  debounceMs = 300,
  onSearch,
  placeholder,
  className = "",
}: SearchInputProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch?.(value), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, onSearch]);

  return (
    <TextInput
      leadingIcon="search"
      placeholder={placeholder ?? "Search..."}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      trailing={
        value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              onSearch?.("");
            }}
            className="text-outline hover:text-on-surface transition-colors"
          >
            <Icon name="close" size={16} />
          </button>
        ) : undefined
      }
      className={className}
    />
  );
}