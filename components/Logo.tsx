/**
 * The brand mark: a house roof over a sprout, with the morning sun.
 * "การบ้าน" (home) + a habit that grows. Plain SVG, no defs, so it can repeat on a page and print on the slip.
 */
export function LogoMark({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="48" height="48" rx="14" fill="#2f4f3a" />
      {/* soft sheen across the top-left */}
      <path d="M14 0h20a14 14 0 0 1 14 14v3C33 24 17 15 0 25V14A14 14 0 0 1 14 0z" fill="#fff" opacity="0.07" />
      <circle cx="37" cy="9.5" r="3.4" fill="#f2c14e" />
      <path d="M8 22 24 8.5 40 22" fill="none" stroke="#fbfcf8" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 40V28" stroke="#fbfcf8" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 31c0-6 4-9.5 9.5-9.5 0 6-4 9.5-9.5 9.5z" fill="#fbfcf8" />
      <path d="M24 33.5c-5.2 0-9-3.6-9-8.5 5.2 0 9 3.6 9 8.5z" fill="#b8cfb3" />
      <path d="M16.5 40h15" stroke="#9cb59a" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark for page headers. */
export function Logo({ sub }: { sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <LogoMark className="h-12 w-12 drop-shadow-[0_8px_14px_rgb(35_61_44/0.28)]" />
      <span className="min-w-0 leading-tight">
        <span className="block font-display text-xl font-bold tracking-tight text-brand">การบ้านหลังนวด</span>
        {sub && <span className="block truncate text-base text-muted">{sub}</span>}
      </span>
    </span>
  );
}
