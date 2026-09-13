import { Finding } from '@/types/domain';
import { StatusBadge } from '@/components/ui/status-badge';

export function FindingsList({ findings }: { findings: Finding[] }): React.ReactElement {
  if (findings.length === 0) {
    return <p className="text-sm text-muted">No findings were produced from the available evidence.</p>;
  }
  return (
    <ul className="space-y-3">
      {findings.map((finding, index) => (
        <li key={`${finding.code}-${index}`} className="rounded-lg border border-line bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge severity={finding.severity} />
            <h3 className="font-medium text-ink">{finding.title}</h3>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{finding.category}</p>
          <p className="mt-1 text-sm text-slate-800">{finding.summary}</p>
          <p className="mt-2 text-sm text-muted">{finding.explanation}</p>
          {finding.recommendation ? (
            <p className="mt-2 text-sm font-medium text-accent">{finding.recommendation}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
