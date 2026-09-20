import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import { SupportRequestForm } from '@/components/support/support-request-form';
import { getSessionUser } from '@/lib/auth/session';
import { buildDiagnosticContext } from '@/lib/support/context';
import { categoryForTool, SUPPORT_CATEGORY_LABELS } from '@/lib/support/catalog';
import { managedSupportPlan } from '@/lib/plans/catalog';
import { SERVICE_DEFINITIONS } from '@/lib/plans/services';
import type { SupportCategory } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Request Support',
  description:
    'Request Ravelyth support for DNS, email, website, SSL, hosting and security problems. Requests are tracked as tickets in your account.',
  alternates: { canonical: '/support/request' },
  robots: { index: false, follow: true },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function SupportRequestPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const user = await getSessionUser();

  // Tool results can link here with diagnostic context. It is sanitized through
  // the same whitelist used when persisting a ticket — unknown keys are dropped
  // and nothing free-form from the query string is trusted verbatim.
  const context = buildDiagnosticContext({
    tool: first(params.tool),
    domain: first(params.domain),
    findingSummary: first(params.finding),
    findingCounts:
      first(params.errors) !== null ||
      first(params.warnings) !== null ||
      first(params.infos) !== null ||
      first(params.passes) !== null
        ? {
            error: Number(first(params.errors) ?? 0),
            warning: Number(first(params.warnings) ?? 0),
            info: Number(first(params.infos) ?? 0),
            pass: Number(first(params.passes) ?? 0),
          }
        : undefined,
    diagnosticReference: first(params.reference),
    capturedAt: first(params.capturedAt),
  });

  const suggestedCategory: SupportCategory = categoryForTool(context?.tool ?? null);
  const plan = managedSupportPlan();

  return (
    <InfoPage
      title="Request support"
      intro="Open a support request with Ravelyth. Every request becomes a tracked ticket in your account, with a reference number and a message history you can reply to."
    >
      <InfoSection title="What Ravelyth support covers" id="coverage">
        <p>
          Support covers hands-on troubleshooting and configuration for the managed services below.
          Diagnostic context from the free tools can be attached automatically, which usually shortens
          the investigation.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {SERVICE_DEFINITIONS.map((service) => (
            <li key={service.slug}>
              <Link href={`/services/${service.slug}`} className="font-medium text-accent hover:text-accent-strong">
                {service.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">
          Work outside this scope is either declined or quoted separately — it is never silently
          assumed. See the{' '}
          <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">
            Managed Support plan ({plan.name})
          </Link>{' '}
          for the exact boundaries.
        </p>
      </InfoSection>

      <InfoSection title="Open a request" id="request">
        <SupportRequestForm
          authenticated={user !== null}
          initialContext={context}
          initialCategory={suggestedCategory}
          categories={Object.entries(SUPPORT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </InfoSection>

      <InfoSection title="Before you submit" id="prepare">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Run the relevant free tool first (DNS Lookup, DNS Health, SPF/DKIM/DMARC, Email Headers) and keep the domain handy.</li>
          <li>Note exactly what you expected and what happens instead, including error messages.</li>
          <li>Note when the problem started and any recent changes (DNS edits, hosting moves, certificate renewals).</li>
        </ul>
        <p className="text-sm text-slate-600">
          Not sure what is wrong? The{' '}
          <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">
            Knowledge Base
          </Link>{' '}
          has structured diagnostic guides for the most common DNS and email problems.
        </p>
      </InfoSection>

      <InfoSection title="What happens next" id="expectations">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Your request receives a ticket reference (RT-YYYY-XXXXXXXX) immediately.</li>
          <li>Replies appear in your account under Support, with an in-app notification — Ravelyth does not send email notifications until an email provider is configured.</li>
          <li>There is no guaranteed response time for requests without an active Managed Support plan; Managed Support tickets are worked as prioritized queue items.</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
