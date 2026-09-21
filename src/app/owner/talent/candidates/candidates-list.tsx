"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Candidate {
  id: string;
  candidateId: string;
  fullName: string;
  email: string;
  phone: string;
  currentLocation: string | null;
  totalExperience: number | null;
  currentCompany: string | null;
  skills: string | null;
  preferredWorkMode: string | null;
  noticePeriod: string | null;
  consentStatus: string;
  createdAt: string;
}

interface CandidatesResponse {
  success: boolean;
  data: { candidates: Candidate[] };
  error?: { message: string };
}

const statusClasses: Record<string, string> = {
  CONSENT_GIVEN: "bg-emerald-500/100/15 text-emerald-300",
  CONSENT_PENDING: "bg-amber-500/100/15 text-amber-300",
  CONSENT_DECLINED: "bg-red-500/100/15 text-red-300",
};

export function OwnerCandidatesList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("limit", "100");
    fetch(`/api/owner/talent/candidates?${params}`)
      .then((r) => r.json())
      .then((data: CandidatesResponse) => {
        if (cancelled) return;
        if (data.success) {
          setCandidates(data.data.candidates);
        } else {
          setError(data?.error?.message ?? "Failed to load candidates");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="rounded-xl border border-line bg-navy-surface p-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none w-64"
        />
        {loading && (
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading...
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && candidates.length === 0 && (
        <div className="mt-8 border border-dashed border-line py-12 text-center">
          <p className="text-sm text-slate-400">No candidates yet. Candidates apply through public job postings.</p>
        </div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="mt-4 divide-y divide-line">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/owner/talent/candidates/${candidate.id}`} className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-ink truncate">{candidate.fullName}</p>
                  <p className="text-xs text-slate-400">{candidate.candidateId}</p>
                </Link>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[candidate.consentStatus] ?? "bg-slate-800 text-slate-300"}`}>
                  {candidate.consentStatus}
                </span>
                <span className="text-xs text-slate-400">{candidate.email}</span>
                {candidate.phone && <span className="text-xs text-slate-400">{candidate.phone}</span>}
                {candidate.totalExperience != null && (
                  <span className="text-xs text-slate-400">{candidate.totalExperience}y exp</span>
                )}
                <div className="ml-auto flex gap-2">
                  <Link href={`/owner/talent/candidates/${candidate.id}`} className="rounded-md px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
