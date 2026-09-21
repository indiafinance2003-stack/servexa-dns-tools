import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { getApplication } from '@/lib/talent/candidates';
import { TALENT_PIPELINE_ORDER, type TalentApplicationStatus } from '@/lib/talent/catalog';
import { TALENT_APPLICATION_TRANSITIONS } from '@/lib/talent/policy';
import ApplicationDetail from './application-detail';

export const metadata: Metadata = {
  title: 'Application Detail - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OwnerApplicationDetailPage({ params }: Props) {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fapplications');
  }

  const { id } = await params;
  const application = await getApplication(id).catch(() => null);
  if (!application) {
    redirect('/owner/talent/applications');
  }

  const nextStatuses =
    TALENT_APPLICATION_TRANSITIONS[application.status as TalentApplicationStatus] ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Application {application.applicationId}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Owner-only pipeline view. Status changes are validated again on the server.
          </p>
        </div>
        <Link
          href="/owner/talent/applications"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-navy-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm"
        >
          <span className="text-lg" aria-hidden="true">&larr;</span> Back to Applications
        </Link>
      </div>
      <div className="mt-6">
        <ApplicationDetail
          application={application}
          nextStatuses={nextStatuses}
          pipeline={TALENT_PIPELINE_ORDER}
        />
      </div>
    </div>
  );
}

