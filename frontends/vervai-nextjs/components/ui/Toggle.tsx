export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        checked ? "bg-primary" : "bg-surface-variant"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-on-primary shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}