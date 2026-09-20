import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'How Ravelyth works, what it measures, what it does not claim, and how accounts work.',
  alternates: { canonical: '/docs/about' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Documentation"
      intro="Ravelyth is a public DNS and email diagnostics website. It performs real lookups through DNS resolver APIs and parses email headers you paste. Accounts are optional and exist only to save DNS analyses."
    >
      <InfoSection title="Tools" id="tools">
        <ul className="list-disc space-y-2 pl-5">
          <li>DNS Lookup — A, AAAA, CNAME, MX, NS, TXT, SOA, SRV, and CAA records in a structured table.</li>
          <li>DNS Health — records, nameservers, SOA, SPF, DMARC, DNSSEC-related data, and Pass/Info/Warning/Error findings.</li>
          <li>SPF Checker — parses the published v=spf1 policy; not a live sender authorization test.</li>
          <li>DKIM Checker — inspects the published key for a selector; no cryptographic signature verification.</li>
          <li>DMARC Checker — reads the _dmarc policy and its tags.</li>
          <li>PTR Lookup — reverse lookups for public IP addresses only.</li>
          <li>Resolver Comparison — side-by-side answers from selected public resolvers; not global propagation.</li>
          <li>Email Headers — received chain, reported authentication results, and domain relationships.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Accounts and saved analyses" id="accounts">
        <p>
          Every tool works without an account. Creating a free account lets you explicitly save DNS lookup results
          to your account page. Saving is always manual — lookups are never recorded automatically. Saved items
          contain the structured DNS result only, are visible only to you, and can be deleted at any time.
        </p>
        <p>
          Passwords are hashed with Argon2id. Sessions use an HttpOnly cookie containing a random token; the
          server stores only a hash of the token and enforces expiry. Raw email headers are never stored, and
          email analyses cannot be saved.
        </p>
      </InfoSection>

      <InfoSection title="What these tools do not do" id="limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>No cryptographic verification of DKIM signatures.</li>
          <li>No live SPF authorization test (published policy is inspected, not enforced).</li>
          <li>No verdict on whether a message is safe or malicious.</li>
          <li>No scanning of private, loopback, or link-local addresses.</li>
          <li>DNSSEC inspection reports record presence, not a validated chain of trust.</li>
          <li>No global propagation measurement — one resolver’s observations at one point in time.</li>
        </ul>
      </InfoSection>

      <InfoSection title="API" id="api">
        <p>
          JSON endpoints live under <code>/api</code>. Domain tools accept GET query parameters or POST JSON. Email
          analysis is POST-only. Responses use <code>{'{ success, data }'}</code> or{' '}
          <code>{'{ success, error }'}</code>.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><code>/api/dns/lookup</code>, <code>/api/dns/analyze</code>, <code>/api/dns/spf</code>, <code>/api/dns/dmarc</code>, <code>/api/dns/dkim</code>, <code>/api/dns/ptr</code>, <code>/api/dns/resolvers</code> — GET and POST.</li>
          <li><code>/api/email/analyze</code> — POST only.</li>
          <li><code>/api/auth/register</code>, <code>/api/auth/login</code>, <code>/api/auth/logout</code> — POST only; <code>/api/auth/me</code> — GET.</li>
          <li><code>/api/account/saved-analyses</code> — GET/POST for the signed-in user; <code>/api/account/saved-analyses/[id]</code> — DELETE.</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}