import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Ravelyth, a free public DNS and email diagnostics toolkit.',
  alternates: { canonical: '/about' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="About Ravelyth"
      intro="Ravelyth is a free public website for DNS lookups and email header diagnostics, built for operators, developers, and anyone investigating mail delivery or domain configuration."
    >
      <InfoSection title="How it works" id="how">
        <p>
          Every result comes from a live DNS query or from parsing the exact input you provide, performed at the
          moment you request it. Diagnostics produce structured evidence — records, nameservers, reported
          authentication results, and findings labeled Pass, Info, Warning, or Error — rather than an unexplained
          score.
        </p>
        <p>
          Lookups use standard DNS resolver APIs rather than shell commands, and private, loopback, and link-local
          targets are refused so the tools cannot be pointed at internal networks.
        </p>
      </InfoSection>
      <InfoSection title="Accounts" id="accounts">
        <p>
          The tools are open to everyone. Optional free accounts exist for one purpose: saving DNS analyses you
          choose to keep. Accounts do not unlock extra diagnostic capabilities, and anonymous use is never
          degraded. Passwords are stored only as Argon2id hashes, and sessions are server-side with an HttpOnly
          cookie.
        </p>
      </InfoSection>
      <InfoSection title="Limits we state plainly" id="limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>DKIM signatures are not cryptographically verified.</li>
          <li>SPF is inspected as published policy; no sender-IP authorization test is performed.</li>
          <li>DNSSEC inspection reports record presence, not a validated chain of trust.</li>
          <li>Results reflect one network’s view at one moment — not global propagation.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Learn more" id="more">
        <p>
          Read the <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">documentation</Link>, the{' '}
          <Link href="/faq" className="font-medium text-accent hover:text-accent-strong">FAQ</Link>, or the{' '}
          <Link href="/guides/dns" className="font-medium text-accent hover:text-accent-strong">guides</Link> to get
          started.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
