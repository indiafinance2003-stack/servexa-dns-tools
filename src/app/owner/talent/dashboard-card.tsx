'use client';

import { useEffect, useState } from 'react';

interface TalentDashboard {
  openJobs: number;
  totalCandidates: number;
  newApplications: number;
  screening: number;
  shortlisted: number;
  clientSubmissions: number;
  upcomingInterviews: number;
  selected: number;
  joined: number;
  pendingFeesMinor: number;
  paidRevenueMinor: number;
  recentActivity: Array<{ id: string; action: string; summary: string | null; createdAt: string }>;
}

function formatINR(minor: number): string {
  if (minor === 0) return '₹0';
  return '₹' + (minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const metric = (label: string, value: number | string, accent?: boolean) => (
  <div className="rounded-lg border border-line bg-navy-surface p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-accent' : 'text-ink'}`}>{value}</p>
  </div>
);

function ActivityList({ items }: { items: TalentDashboard['recentActivity'] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No recent activity.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="py-2 text-sm text-slate-400">
          <span className="font-medium">{item.action}</span>
          {item.summary ? <span className="ml-1">— {item.summary}</span> : null}
          <span className="ml-2 text-slate-400">
            {new Date(item.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TalentDashboardCard() {
  const [metrics, setMetrics] = useState<TalentDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/owner/talent/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setMetrics(data.data.metrics);
        } else {
          setError(data?.error?.message ?? 'Failed to load dashboard data');
        }
      })
      .catch(() => setError('Network error loading dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="rounded-xl border border-line bg-navy-surface p-6">
      <h2 className="text-base font-semibold text-ink">Dashboard</h2>
      <p className="mt-1 text-xs text-slate-400">Real-time recruitment metrics. No simulated data.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metric('Open Jobs', metrics.openJobs, true)}
        {metric('Total Candidates', metrics.totalCandidates)}
        {metric('New Applications', metrics.newApplications)}
        {metric('Screening', metrics.screening)}
        {metric('Shortlisted', metrics.shortlisted)}
        {metric('Client Submissions', metrics.clientSubmissions)}
        {metric('Upcoming Interviews', metrics.upcomingInterviews)}
        {metric('Selected', metrics.selected)}
        {metric('Joined', metrics.joined)}
        {metric('Pending Fees', formatINR(metrics.pendingFeesMinor))}
        {metric('Paid Revenue', formatINR(metrics.paidRevenueMinor))}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Recent Activity</h3>
        <ActivityList items={metrics.recentActivity} />
      </div>
    </div>
  );
}
