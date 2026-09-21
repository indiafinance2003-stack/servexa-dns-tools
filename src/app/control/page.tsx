import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Ravelyth Control',
  description:
    'Ravelyth Control is coming soon — an infrastructure control plane for licensing, remote agent commands, and software delivery on your servers.',
  alternates: { canonical: '/control' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Ravelyth Control"
      intro="The infrastructure control plane for your servers is in active design. This page describes what it will do and what is explicitly not built yet."
    >
      <InfoSection title="Coming soon" id="coming-soon">
        <p>
          Ravelyth Control is not accepting customers yet. There is no signup, no dashboard, and no agent to
          install — any page or tool that suggests otherwise is not part of this product.
        </p>
      </InfoSection>
      <InfoSection title="What Control is for" id="scope">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Server licensing:</strong> issue and validate per-server license keys so your software runs only
            where you authorise it.
          </li>
          <li>
            <strong>Remote agent:</strong> a lightweight agent on your servers that sends telemetry and executes
            commands you schedule from the Control dashboard.
          </li>
          <li>
            <strong>Software delivery:</strong> stage, publish, and push build releases to registered servers with
            signed manifests.
          </li>
        </ul>
        <p className="mt-3">
          The foundation for these capabilities already exists in Ravelyth&apos;s internal libraries, but nothing is
          exposed publicly until the first release is ready.
        </p>
      </InfoSection>
      <InfoSection title="While you wait" id="alternatives">
        <p>
          Until Control launches, the diagnostics are available to everyone, and Managed Support is the support lane
          for DNS, email, and hosting problems.
        </p>
        <p>
          <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">Managed Support</Link> ·{' '}
          <Link href="/#tools" className="font-medium text-accent hover:text-accent-strong">Diagnostic tools</Link>
        </p>
      </InfoSection>
      <InfoSection title="No simulated results" id="truthfulness">
        <p>
          Ravelyth does not publish “demo” control panels or pretend an unreleased product exists. When Control
          becomes available, this page will link to the real signing-up flow and the first release notes.
        </p>
      </InfoSection>
    </InfoPage>
  );
}