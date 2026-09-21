import Link from 'next/link';

export function RavelythMark({ size = 28 }: { size?: number }): React.ReactElement {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="5.5" fill="#0b1220" />
        <circle cx="12" cy="12" r="7.5" fill="none" stroke="#38bdf8" strokeWidth="1.3" />
        <ellipse cx="12" cy="12" rx="3.1" ry="7.5" fill="none" stroke="#60a5fa" strokeWidth="0.9" />
        <ellipse cx="12" cy="12" rx="7.5" ry="2.6" fill="none" stroke="#2563eb" strokeWidth="0.9" />
        <circle cx="12" cy="12" r="1.4" fill="#7dd3fc" />
      </svg>
    </span>
  );
}

export function RavelythLogo({
  href = '/',
  size = 28,
}: {
  href?: string;
  size?: number;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label="Ravelyth — home"
      className="inline-flex items-center gap-2 rounded-md"
    >
      <RavelythMark size={size} />
      <span className="text-lg font-semibold tracking-tight text-ink">Ravelyth</span>
    </Link>
  );
}