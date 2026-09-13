import type { Metadata } from 'next';
import { InfoPage, InfoSection } from '@/components/layout/info-page';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about how Ravelyth works: data sources, accounts, rate limits, and the limits of DNS diagnostics.',
  alternates: { canonical: '/faq' },
};

const faqs = [
  {
    question: 'Where do the DNS results come from?',
    answer:
      'Live queries performed by Ravelyth through standard DNS resolver APIs when you submit a request. Results are not simulated, cached from another provider, or generated from sample data.',
  },
  {
    question: 'Do I need an account to use the tools?',
    answer:
      'No. Every DNS and email diagnostic is available without an account. An optional free account lets you save DNS lookup results for later.',
  },
  {
    question: 'What do you store about my lookups?',
    answer:
      'Anonymous lookups are not persisted. If you are signed in and explicitly choose “Save analysis”, the structured DNS result (record type, status, records, query time) is saved to your account. Raw email headers are never stored.',
  },
  {
    question: 'Why does the TTL column show “—”?',
    answer:
      'TTLs are displayed only when the DNS resolver actually returns them for a record. A dash means no TTL was provided for that record; Ravelyth never estimates or fabricates one.',
  },
  {
    question: 'Does DNS Health test worldwide DNS propagation?',
    answer:
      'No. DNS Health shows what one resolver observed for your domain at the time of the check, with findings labeled Pass, Info, Warning, or Error. It does not measure how servers in other regions would answer.',
  },
  {
    question: 'Does Ravelyth verify DKIM signatures or DNSSEC chains?',
    answer:
      'No. DKIM signature verification requires the original message bytes and is out of scope. DNSSEC inspection reports whether DS, DNSKEY, or RRSIG records are observed; it does not validate a chain of trust. Both limits are stated in the tools themselves.',
  },
  {
    question: 'Why was my request rate limited?',
    answer:
      'Rate limits protect the service from abuse and keep lookups fast for everyone. In-memory limits apply per client over a rolling window, with stricter limits on login and registration attempts.',
  },
  {
    question: 'Why can I not look up private IP addresses or localhost?',
    answer:
      'For security. Names and IP targets that resolve to private, loopback, link-local, or otherwise non-public ranges are rejected so the tools cannot be used to probe internal networks.',
  },
  {
    question: 'Are the reported Authentication-Results in email headers trustworthy?',
    answer:
      'They are claims made by the servers that handled the message. Ravelyth shows them as reported and clearly separates that from what it independently parses. It does not independently authenticate a message from headers alone.',
  },
];

export default function Page(): React.ReactElement {
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  });

  return (
    <InfoPage
      title="Frequently asked questions"
      intro="How Ravelyth works, what it stores, and what DNS diagnostics can honestly tell you."
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {faqs.map((faq) => (
        <InfoSection key={faq.question} title={faq.question}>
          <p>{faq.answer}</p>
        </InfoSection>
      ))}
    </InfoPage>
  );
}
