const icons: Record<string, React.ReactElement> = {
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.6" ry="8.5" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.2" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M3.5 8 12 13.5 20.5 8" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="8" cy="11.5" r="4.5" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M12.5 11.5H20M17 11.5v3M20 11.5v3" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="M12 3.5 19 6v6.5c0 4-3 7-7 8-4-1-7-4-7-8V6l7-2.5Z" />
      <path d="m8.5 12 2.5 2.5L15.5 9.5" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <rect x="6.5" y="11" width="11" height="8.5" rx="1.5" />
      <path d="M9 11V8.5a3 3 0 0 1 6 0V11" />
    </svg>
  ),
  reverse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <circle cx="7" cy="12" r="4.5" />
      <path d="M11.5 12h8M17 9.5 19.5 12 17 14.5" />
    </svg>
  ),
  compare: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M3 20h18" />
      <rect x="5.5" y="13.5" width="4" height="6.5" rx="0.5" />
      <rect x="15" y="9.5" width="4" height="10.5" rx="0.5" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </svg>
  ),
};

export function ToolIcon({ name, className }: { name: string; className?: string }): React.ReactElement {
  const icon = icons[name] ?? icons.globe;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-accent${className ? ` ${className}` : ''}`}
    >
      {icon}
    </span>
  );
}