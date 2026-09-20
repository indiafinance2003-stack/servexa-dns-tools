import 'server-only';
import { sql } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentApplications, talentCandidates } from '@/lib/db/schema';
import { countOpenJobs } from './jobs';
import { isActiveApplicationStatus } from './policy';
import { listRecentTalentActivity } from './activity';
import { countUpcomingInterviews } from './interviews';
import { placementRevenueTotals } from './placements';

export interface TalentDashboard {
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

export async function talentDashboardMetrics(): Promise<TalentDashboard> {
  const { db } = dbFromRequest();
  const openJobs = await countOpenJobs();
  const candidateCount = await db.select({ value: sql<number>`count(*)::int` }).from(talentCandidates);
  const applications = await db.select({ status: talentApplications.status }).from(talentApplications);
  const byStatus = (status: string) => applications.filter((a) => a.status === status).length;
  const upcomingInterviews = await countUpcomingInterviews();
  const revenue = await placementRevenueTotals();
  const activity = await listRecentTalentActivity(12);
  return {
    openJobs,
    totalCandidates: candidateCount[0]?.value ?? 0,
    newApplications: byStatus('NEW'),
    screening: byStatus('SCREENING') + byStatus('CONTACTED') + byStatus('INTERESTED'),
    shortlisted: byStatus('SHORTLISTED'),
    clientSubmissions: byStatus('CLIENT_SUBMITTED') + byStatus('INTERVIEW'),
    upcomingInterviews,
    selected: byStatus('SELECTED') + byStatus('OFFER'),
    joined: byStatus('JOINED'),
    pendingFeesMinor: revenue.pendingMinor,
    paidRevenueMinor: revenue.paidMinor,
    recentActivity: activity.map((a) => ({ id: a.id, action: a.action, summary: a.summary, createdAt: a.createdAt.toISOString() })),
  };
}

export function activePipelineCount(statuses: string[]): number {
  return statuses.filter((s) => isActiveApplicationStatus(s)).length;
}

export async function talentDashboardSafe(): Promise<TalentDashboard | null> {
  try {
    return await talentDashboardMetrics();
  } catch {
    return null;
  }
}
