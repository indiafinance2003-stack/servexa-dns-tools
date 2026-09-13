import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Email Authentication Guides',
  description: 'Accurate explanations of SPF, DKIM, and DMARC: what each one does, and what checking a record can and cannot prove.',
  alternates: { canonical: '/guides/email' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Email authentication guides"
      intro="SPF, DKIM, and DMARC are published policies that receiving mail servers evaluate. These guides explain what each mechanism actually covers."
    >
      <InfoSection title="SPF — which servers may send" id="spf">
        <p>
          An SPF record is a TXT record starting with <code>v=spf1</code>. It lists the servers allowed to send
          mail for a domain using mechanisms such as <code>ip4:</code>, <code>ip6:</code>, <code>a</code>,{' '}
          <code>mx</code>, and <code>include:</code>. Receiving servers compare the connecting IP address against
          this policy.
        </p>
        <p>
          Checking the published record with Ravelyth reviews the policy text: mechanisms, modifiers, and common
          mistakes. It is not a live authorization test — Ravelyth does not send mail, so it cannot tell you
          whether a particular IP would pass on a given day.
        </p>
        <p>
          SPF is evaluated per-envelope-sender domain (the return path), and the specification limits the number of
          DNS queries an evaluation may consume (10 lookups). Overly long include chains can invalidate a policy.
        </p>
      </InfoSection>

      <InfoSection title="DKIM — signed messages" id="dkim">
        <p>
          A DKIM signature is added to a message by the sending infrastructure. The signature header names a
          domain (<code>d=</code>) and a selector (<code>s=</code>); the public key is published in DNS at{' '}
          <code>&lt;selector&gt;._domainkey.&lt;domain&gt;</code>. The receiving server recomputes hashes of the
          signed headers and body and verifies them against the signature using the published public key.
        </p>
        <p>
          Ravelyth’s DKIM Checker looks up the published key record for a selector and inspects its flags and key
          material. It does not verify a specific message’s signature — to do that you would need the original
          message bytes and a cryptographic verification implementation, which Ravelyth intentionally does not
          perform.
        </p>
      </InfoSection>

      <InfoSection title="DMARC — the policy layer" id="dmarc">
        <p>
          A DMARC record is a TXT record at <code>_dmarc.&lt;domain&gt;</code>. It tells receiving servers what to
          do when SPF and DKIM evaluation does not pass with an aligned identifier: <code>p=none</code> (take no
          action), <code>p=quarantine</code> (treat as suspicious), or <code>p=reject</code> (refuse delivery). It
          also defines reporting addresses (<code>rua</code> for aggregate reports, <code>ruf</code> for failure
          reports) and how subdomains inherit policy (<code>sp</code>).
        </p>
        <p>
          Alignment matters: for SPF or DKIM to “pass DMARC”, the authenticated domain must match the visible
          From domain, either exactly (strict) or at the organizational-domain level (relaxed).
        </p>
      </InfoSection>

      <InfoSection title="Reading email headers" id="headers">
        <p>
          Every hop a message takes normally adds a <code>Received</code> header. The Email Header Analyzer parses
          that chain, lists <code>Authentication-Results</code> as reported by receiving servers, and maps the
          domains involved. Reported results are claims made by other servers — Ravelyth does not independently
          re-verify SPF, DKIM, or DMARC from a pasted header, because verification requires live message data that
          headers alone do not contain.
        </p>
      </InfoSection>

      <InfoSection title="Privacy note" id="privacy">
        <p>
          Pasted email headers can contain personal information. Ravelyth analyzes them only in memory for the
          request you submit, never stores them, and never associates them with an account. Saved analyses are
          limited to structured DNS results that you explicitly save.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
