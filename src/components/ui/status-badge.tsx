import { FindingSeverity } from '@/types/domain';

const styles: Record<FindingSeverity, { symbol: string; label: string; className: string }> = {
  pass: { symbol: '✓', label: 'Pass', className: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  info: { symbol: 'i', label: 'Info', className: 'bg-slate-100 text-slate-700 ring-slate-300' },
  warning: { symbol: '!', label: 'Warning', className: 'bg-amber-50 text-amber-900 ring-amber-300' },
  error: { symbol: '×', label: 'Error', className: 'bg-red-50 text-red-900 ring-red-300' },
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
