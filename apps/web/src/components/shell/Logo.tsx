export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden>
        <path
          d="M3 20 C 9 6, 19 6, 25 20"
          fill="none"
          className="stroke-agent"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="14" cy="10" r="3" className="fill-gate" />
      </svg>
      {withName ? <span className="font-display text-heading-sm text-strong">Throughline</span> : null}
    </span>
  );
}
