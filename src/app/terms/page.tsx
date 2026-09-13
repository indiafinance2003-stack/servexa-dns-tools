import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply to using the Ravelyth diagnostics tools.',
  alternates: { canonical: '/terms' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Terms of service"
      intro="These terms govern use of the Ravelyth diagnostics tools. By using the site you agree to them."
    >
      <InfoSection title="The service" id="service">
        <p>
          Ravelyth provides free, publicly accessible DNS and email header diagnostics. Results are produced by
          live queries and parsing performed at request time. The service is offered as-is, without any uptime
          commitment or service-level agreement.
        </p>
      </InfoSection>
      <InfoSection title="Acceptable use" id="use">
        <ul className="list-disc space-y-2 pl-5">
          <li>Do not use the tools to probe, attack, or enumerate private or non-public networks; such targets are blocked.</li>
          <li>Do not attempt to bypass rate limits, overload the service, or automate abusive volumes of requests.</li>
          <li>Do not attempt to access other users’ accounts or saved data.</li>
          <li>Do not submit content you do not have the right to submit, such as third parties’ private email headers.</li>
        </ul>
        <p>
          Access may be rate limited or refused if these rules are violated, including by IP-based request throttling.
        </p>
      </InfoSection>
      <InfoSection title="Accounts" id="accounts">
        <p>
          Accounts are optional. You are responsible for keeping your password confidential. Accounts may be
          suspended if used to violate these terms. You can end your session at any time by signing out; saved
          analyses can be deleted from your account page.
        </p>
      </InfoSection>
      <InfoSection title="No warranty" id="warranty">
        <p>
          DNS and email diagnostics reflect observations made by one system at one point in time. They can be
          affected by caching, DNS propagation, resolver differences, and the content of the inputs you provide.
          Ravelyth makes no warranty as to the completeness or fitness of results for any particular purpose,
          including mail delivery or security decisions. Verify critical changes against your own authoritative
          infrastructure.
        </p>
      </InfoSection>
      <InfoSection title="Limitation of liability" id="liability">
        <p>
          To the maximum extent permitted by law, the Ravelyth project is not liable for any damages arising from
          use of, or inability to use, the service — including decisions made on the basis of diagnostic results.
        </p>
      </InfoSection>
      <InfoSection title="Changes" id="changes">
        <p>
          These terms may be updated as the service evolves. Material changes will be reflected on this page with
          an updated description. Continued use after changes constitutes acceptance.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
