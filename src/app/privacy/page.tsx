import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What Ravelyth stores, what it does not store, and how accounts and diagnostics data are handled.',
  alternates: { canonical: '/privacy' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Privacy policy"
      intro="This page describes what Ravelyth actually does with data. It is intentionally specific: anything not listed here is not collected."
    >
      <InfoSection title="Anonymous diagnostic requests" id="diagnostics">
        <p>
          DNS lookups, DNS health checks, SPF/DKIM/DMARC checks, PTR lookups, resolver comparisons, and email
          header analysis all work without an account. The inputs you submit and the results produced are processed
          for your request in memory and are not persisted to a database. What you look up is not attached to any
          identity.
        </p>
      </InfoSection>
      <InfoSection title="Email headers" id="headers">
        <p>
          Raw email headers you paste are parsed for the single request you submit and are never stored, logged, or
          saved to any account. There is no email header history feature, and account users cannot save email
          analyses — only structured DNS results are saveable.
        </p>
      </InfoSection>
      <InfoSection title="Account data" id="accounts">
        <p>
          If you create an optional account, Ravelyth stores your name, email address, a cryptographic hash of
          your password (Argon2id), the account creation time, and the time of your most recent sign-in. Passwords
          are never stored in plaintext and never appear in logs.
        </p>
      </InfoSection>
      <InfoSection title="Sign-in sessions" id="sessions">
        <p>
          Signing in creates a server-side session: a cryptographically random token is stored in an HttpOnly
          cookie and only a hash of that token is stored server-side. Sessions expire after seven days and expired
          sessions are removed. Signing out invalidates the session server-side and clears the cookie. Ravelyth
          does not use localStorage for authentication.
        </p>
      </InfoSection>
      <InfoSection title="Saved analyses" id="saved">
        <p>
          When you explicitly choose “Save analysis” for a DNS lookup, Ravelyth stores the structured result
          (domain, record type, status, records, query time) in your account. Saved analyses are visible only to
          you and are deleted when you delete them or when you request account deletion. Saving never happens
          automatically.
        </p>
      </InfoSection>
      <InfoSection title="Rate limiting and abuse prevention" id="rate-limiting">
        <p>
          To keep the service available, Ravelyth applies in-memory rate limits per client over rolling windows,
          with stricter limits on login and registration. These counters live in application memory; they are not
          exported to third parties. Private and non-public network targets are refused and cannot be scanned
          through the tools.
        </p>
      </InfoSection>
      <InfoSection title="Cookies" id="cookies">
        <p>
          Ravelyth sets exactly one cookie: the session cookie described above. It contains no personal data, no
          database identifiers beyond the opaque session token, and is not used for advertising or tracking.
          Visitors without an account receive no cookies from Ravelyth.
        </p>
      </InfoSection>
      <InfoSection title="What Ravelyth does not do" id="not">
        <ul className="list-disc space-y-2 pl-5">
          <li>No third-party analytics or advertising scripts.</li>
          <li>No sale or sharing of user data.</li>
          <li>No profiling of visitors or lookups.</li>
          <li>No storage of email headers, ever.</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
