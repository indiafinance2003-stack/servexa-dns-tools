import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'DNS Guides',
  description: 'Plain-language explanations of DNS record types, delegation, TTLs, and DNSSEC concepts.',
  alternates: { canonical: '/guides/dns' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="DNS guides"
      intro="Short, factual explanations of the concepts behind the Ravelyth DNS tools. No fluff, no unsupported claims."
    >
      <InfoSection title="What a DNS record is" id="records">
        <p>
          The Domain Name System maps names to data. Each record has a type, a name, a value, and a time to live
          (TTL) that tells resolvers how long they may cache the answer. When you run a lookup in Ravelyth, the
          values come from a live DNS query, and a TTL is displayed only when the resolver actually returns one —
          otherwise the table shows “—”.
        </p>
      </InfoSection>

      <InfoSection title="Record types supported by DNS Lookup" id="types">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>A / AAAA</strong> — map a name to an IPv4 or IPv6 address.
          </li>
          <li>
            <strong>CNAME</strong> — an alias pointing one name at another name. Lookups then continue on the
            target name.
          </li>
          <li>
            <strong>MX</strong> — mail exchanger hosts for a domain, each with a priority. Lower priority numbers
            are tried first.
          </li>
          <li>
            <strong>NS</strong> — the authoritative nameservers delegated for a zone.
          </li>
          <li>
            <strong>TXT</strong> — free-form text. Commonly used for SPF policies and ownership verification.
          </li>
          <li>
            <strong>SOA</strong> — start of authority: the zone’s primary nameserver, responsible mailbox, serial
            number, and timing values (refresh, retry, expire, minimum).
          </li>
          <li>
            <strong>SRV</strong> — service locations: priority, weight, port, and target host.
          </li>
          <li>
            <strong>CAA</strong> — a policy naming which certificate authorities may issue certificates for the
            domain.
          </li>
        </ul>
      </InfoSection>

      <InfoSection title="How delegation works" id="delegation">
        <p>
          Resolvers walk the DNS hierarchy from the root servers down through top-level domains to a domain’s
          authoritative nameservers. The NS records published for a domain say which servers are supposed to answer
          authoritatively for it. The DNS Health tool lists the nameservers it observed and whether it could resolve
          each one to an address — it does not test servers in every region of the world.
        </p>
      </InfoSection>

      <InfoSection title="TTLs and caching" id="tts">
        <p>
          A TTL is a publisher’s hint about how long an answer may be reused. Shorter TTLs make changes visible
          sooner but increase query volume. Records such as MX often carry TTLs from the zone; some answers (for
          example a CNAME chain or SOA from certain resolvers) may not include one. Ravelyth never invents a TTL: a
          missing value is displayed as “—”.
        </p>
      </InfoSection>

      <InfoSection title="DNSSEC, honestly described" id="dnssec">
        <p>
          DNSSEC adds digital signatures to DNS data so resolvers can verify answers came from the zone owner.
          Observing DS, DNSKEY, or RRSIG records indicates the zone publishes signing material. Ravelyth reports
          whether those records are present. It does not build or validate a full chain of trust to the root, so
          “records observed” is not the same as “cryptographically validated”.
        </p>
      </InfoSection>

      <InfoSection title="What these tools cannot tell you" id="limits">
        <ul className="list-disc space-y-2 pl-5">
          <li>Global propagation or what “users in other countries” would see.</li>
          <li>Whether a mail server actually accepts mail for a domain.</li>
          <li>Whether DNSSEC validation would succeed on a validating resolver.</li>
        </ul>
        <p>
          Results reflect the queries Ravelyth actually performed from its own network at the time of the request.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
