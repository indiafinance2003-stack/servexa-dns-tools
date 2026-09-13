'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDelete, formatApiError } from '@/lib/client/api';

export interface SavedAnalysisItem {
  id: string;
  analysisType: string;
  target: string;
  result: unknown;
  createdAt: string;
}

function summarizeResult(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const record = result as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.recordType === 'string') parts.push(record.recordType);
  if (typeof record.status === 'string') parts.push(record.status);
  if (Array.isArray(record.records)) parts.push(`${record.records.length} record(s)`);
  return parts.join(' · ');
}

export function SavedAnalysesList({ items }: { items: SavedAnalysisItem[] }): React.ReactElement {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await apiDelete(`/api/account/saved-analyses/${id}`);
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        You have not saved any analyses yet. Run a DNS lookup and choose “Save analysis” to keep it here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm text-ink">{item.target}</p>
              <p className="text-xs text-slate-500">
                {item.analysisType} · {summarizeResult(item.result)} ·{' '}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              disabled={deletingId === item.id}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-700 disabled:opacity-60"
            >
              {deletingId === item.id ? 'Deleting…' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Saved analyses contain structured DNS results only. Raw email headers are never stored by Ravelyth.
      </p>
    </div>
  );
}
