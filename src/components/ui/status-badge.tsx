import { FindingSeverity } from '@/types/domain';

const styles: Record<FindingSeverity, string> = {
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-slate-100 text-slate-700 ring-slate-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  error: 'bg-red-50 text-red-800 ring-red-200',
};

export function StatusBadge({ severity }: { severity: FindingSeverity }): React.ReactElement {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[severity]}`}>
      {severity}
    </span>
  );
}
