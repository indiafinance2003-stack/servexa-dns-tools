import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the Ravelyth project.',
  alternates: { canonical: '/contact' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Contact"
      intro="Ravelyth is a small, focused diagnostics project. The fastest way to get an answer is through the channels below."
    >
      <InfoSection title="Security issues" id="security">
        <p>
          Suspected vulnerabilities or abuse of the service should be reported through the process on the{' '}
          <Link href="/security" className="font-medium text-accent hover:text-accent-strong">
            Security page
          </Link>
          . Please do not describe exploit details in public issue trackers.
        </p>
      </InfoSection>
      <InfoSection title="Everything else" id="other">
        <p>
          Bug reports and feedback about the tools are best raised in the project’s repository issue tracker at{' '}
          <a
            href="https://github.com/indiafinance2003-stack/servexa-dns-tools"
            className="font-medium text-accent hover:text-accent-strong"
            rel="noopener noreferrer"
          >
            github.com/indiafinance2003-stack/servexa-dns-tools
          </a>
          . Include the tool you used, the exact input, and the time of the request so results can be reproduced.
        </p>
        <p>
          A dedicated support email address is not published here. When the project operates one, it will be
          configured through the application’s environment and listed on this page.
        </p>
      </InfoSection>
      <InfoSection title="What to include" id="include">
        <ul className="list-disc space-y-2 pl-5">
          <li>The tool page you used (for example /dns/lookup).</li>
          <li>The exact domain, record type, or header input.</li>
          <li>The timestamp (UTC) of the request.</li>
          <li>A short description of what you expected versus what was shown.</li>
        </ul>
        <p>
          Please never paste passwords, full email headers with personal information, or anything you would not
          want published when requesting help.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
