'use client';

import { useCallback, useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'spam', label: 'Spam' },
];

export function ContactTriage({
  submissionId,
  currentStatus,
}: {
  submissionId: string;
  currentStatus: string;
}): React.ReactElement {
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    async (next: string) => {
      if (next === status || busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/owner/contact/${submissionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        const payload = (await response.json()) as {
          success: boolean;
          error?: { message?: string };
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? 'Could not update the status.');
        }
        setStatus(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update the status.');
      } finally {
        setBusy(false);
      }
    },
    [busy, submissionId, status]
  );

  return (
    <div>
      <select
        value={status}
        disabled={busy}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-line bg-navy-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}