import { FindingSeverity } from '@/types/domain';

const styles: Record<FindingSeverity, { symbol: string; label: string; className: string }> = {
  pass: { symbol: '✓', label: 'Pass', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40' },
  info: { symbol: 'i', label: 'Info', className: 'bg-slate-800 text-slate-300 ring-slate-300' },
  warning: { symbol: '!', label: 'Warning', className: 'bg-amber-500/10 text-amber-300 ring-amber-500/40' },
  error: { symbol: '×', label: 'Error', className: 'bg-red-500/10 text-red-300 ring-red-500/40' },
};

export function StatusBadge({
  severity,
  className,
}: {
  severity: FindingSeverity;
  className?: string;
}): React.ReactElement {
  const style = styles[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}${className ? ` ${className}` : ''}`}
    >
      <span aria-hidden="true" className="font-semibold">
        {style.symbol}
      </span>
      <span>{style.label}</span>
    </span>
  );
}
