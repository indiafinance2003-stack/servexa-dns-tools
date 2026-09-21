import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import { SupportRequestForm } from '@/components/support/support-request-form';
import { getSessionUser } from '@/lib/auth/session';
import { getManagedSupportEntitlement } from '@/lib/support/entitlement';
import { buildDiagnosticContext } from '@/lib/support/context';
import { categoryForTool, SUPPORT_CATEGORY_LABELS } from '@/lib/support/catalog';
import { managedSupportPlan } from '@/lib/plans/catalog';
import { SERVICE_DEFINITIONS } from '@/lib/plans/services';
import type { SupportCategory } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Request Support',
  description:
    'Request Managed Support for DNS, email, website, SSL, hosting and security problems. Requests are tracked as tickets in your account.',
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

  let entitled = false;
  let statusReason: string | null = null;
  if (user) {
    const entitlement = await getManagedSupportEntitlement(user.id);
    entitled = entitlement.entitled;
    statusReason = entitlement.reason;
  }

  return (
    <InfoPage
      title="Request support"
      intro="Managed Support requests are opened as tracked tickets in your account, with a reference number and a message history you can reply to."
    >
      <InfoSection title="What Managed Support covers" id="coverage">
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
        <p className="text-sm text-slate-400">
          Every request requires the{' '}
          <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">
            Managed Support plan ({plan.name})
          </Link>
          . Work outside this scope is either declined or quoted separately — it is never silently
          assumed.
        </p>
      </InfoSection>

      {user === null ? (
        <InfoSection title="Open a request" id="request">
          <p className="rounded-lg bg-sky-500/10 p-3 text-sm text-sky-300">
            Requests are tracked in your Ravelyth account.{' '}
            <Link href="/login" className="font-medium underline hover:text-sky-200">Sign in</Link>{' '}
            or{' '}
            <Link href="/register" className="font-medium underline hover:text-sky-200">create an account</Link>{' '}
            to continue. All diagnostic tools are free and open to everyone.
          </p>
        </InfoSection>
      ) : !entitled ? (
        <InfoSection title="Managed Support is required to submit a request" id="request">
          <p>
            Support tickets are part of the paid Managed Support plan. Your account does not currently
            have an active plan{statusReason ? ` — ${statusReason}` : ''}.
          </p>
          <p className="text-sm text-slate-400">
            The free diagnostic tools remain available to you, and the{' '}
            <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">Knowledge Base</Link>{' '}
            already covers the most common DNS and email problems.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/pricing"
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
            >
              See the Managed Support plan
            </Link>
            <Link
              href="/services"
              className="rounded-md border border-line px-4 py-2 text-slate-300 hover:border-accent hover:text-accent"
            >
              What support covers
            </Link>
          </div>
        </InfoSection>
      ) : (
        <InfoSection title="Open a request" id="request">
          <SupportRequestForm
            authenticated
            initialContext={context}
            initialCategory={suggestedCategory}
            categories={Object.entries(SUPPORT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </InfoSection>
      )}

      <InfoSection title="Before you submit" id="prepare">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Run the relevant free tool first (DNS Lookup, DNS Health, SPF/DKIM/DMARC, Email Headers) and keep the domain handy.</li>
          <li>Note exactly what you expected and what happens instead, including error messages.</li>
          <li>Note when the problem started and any recent changes (DNS edits, hosting moves, certificate renewals).</li>
        </ul>
        <p className="text-sm text-slate-400">
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
          <li>Managed Support tickets are worked as prioritized queue items with no separately-published guarantee.</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}