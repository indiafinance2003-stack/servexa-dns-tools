import { Finding } from '@/types/domain';
import { StatusBadge } from '@/components/ui/status-badge';

export function FindingsList({ findings }: { findings: Finding[] }): React.ReactElement {
  if (findings.length === 0) {
    return <p className="text-sm text-slate-500">No findings were produced from the available evidence.</p>;
  }
  return (
    <ul className="space-y-3">
      {findings.map((finding) => (
        <li key={`${finding.code}-${finding.title}`} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge severity={finding.severity} />
            <h3 className="font-medium text-slate-900">{finding.title}</h3>
          </div>
          <p className="text-sm text-slate-800">{finding.summary}</p>
          <p className="mt-2 text-sm text-slate-600">{finding.explanation}</p>
          {finding.recommendation ? (
            <p className="mt-2 text-sm text-teal-900">{finding.recommendation}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
