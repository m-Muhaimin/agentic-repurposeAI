export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="10" fill="#09090B" />
      <path
        d="M12 12L20 28L28 12"
        stroke="#FAFAFA"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="2.5" fill="#10B981" />
    </svg>
  );
}