import {
  EmailDomainHealthResult,
  EmailDomainHealthSection,
  Finding,
} from '@/types/domain';
import { DNSRecordType } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeDNSRecord } from '@/lib/dns/normalization/dns-normalizer';
import { analyzeSPF } from '@/lib/dns/analysis/spf-analyzer';
import { analyzeDMARC } from '@/lib/dns/analysis/dmarc-analyzer';
import { analyzeDKIM } from '@/lib/dns/analysis/dkim-analyzer';
import { lookupPTR } from '@/lib/dns/analysis/ptr-lookup';
import { finding } from '@/lib/dns/analysis/findings';

/**
 * Email-domain health built entirely from DNS observations and the existing
 * analyzers. It never claims to test actual mail delivery: no SMTP
 * conversation takes place, and results say so.
 */

function severityRank(status: EmailDomainHealthSection['status']): number {
  switch (status) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    case 'info':
      return 1;
    default:
      return 0;
  }
}

function worstSection(sections: EmailDomainHealthSection[]): EmailDomainHealthSection['status'] {
  return sections.reduce<EmailDomainHealthSection['status']>(
    (worst, section) => (severityRank(section.status) > severityRank(worst) ? section.status : worst),
    'pass'
  );
}

async function mxSection(domain: string, budget?: QueryBudget): Promise<EmailDomainHealthSection> {
  const result = await resolveDNS(domain, DNSRecordType.MX, { budget });
  const records = normalizeDNSRecord(DNSRecordType.MX, result.records) as string[];

  if (result.status === 'success' && records.length > 0) {
    const findings = [
      finding(
        'MX_PRESENT',
        'pass',
        'email',
        'Mail exchangers are published',
        `${records.length} MX record(s) were returned for ${domain}.`,
        'MX records name the hosts that accept mail for the domain.'
      ),
    ];
    const nullMx = records.some((value) => /\b0\s+\.$/.test(value));
    if (nullMx) {
      findings.push(
        finding(
          'MX_NULL',
          'info',
          'email',
          'Null MX (RFC 7505) observed',
          'The domain publishes a "0 ." MX record, which explicitly declares that it accepts no mail.',
          'A null MX is correct when the domain never sends or receives mail.'
        )
      );
    }
    return {
      key: 'mx',
      title: 'Mail exchangers (MX)',
      status: 'pass',
      summary: `${records.length} MX record(s) observed.`,
      details: records,
      findings,
    };
  }

  const detail = result.error ?? `The resolver returned status "${result.status}" for the MX query.`;
  return {
    key: 'mx',
    title: 'Mail exchangers (MX)',
    status: 'warning',
    summary: 'No usable MX records were returned.',
    details: [detail],
    findings: [
      finding(
        'MX_MISSING',
        'warning',
        'email',
        'No MX records observed',
        detail,
        'Without MX records, other mail systems have to fall back to the A/AAAA address (RFC 5321), and many will not. Publish MX records if the domain should receive mail.'
      ),
    ],
  };
}

function statusFromFindings(findings: Finding[]): EmailDomainHealthSection['status'] {
  if (findings.some((item) => item.severity === 'error')) return 'error';
  if (findings.some((item) => item.severity === 'warning')) return 'warning';
  return 'pass';
}

async function spfSection(domain: string, budget?: QueryBudget): Promise<EmailDomainHealthSection> {
  const analysis = await analyzeSPF(domain, budget);
  const hasRecord = analysis.records.length > 0;
  const status = hasRecord ? statusFromFindings(analysis.findings) : 'warning';

  return {
    key: 'spf',
    title: 'SPF policy',
    status,
    summary: hasRecord
      ? analysis.findings.some((item) => item.severity === 'error')
        ? 'An SPF record was found, but it contains errors.'
        : 'An SPF record was found and parsed.'
      : 'No SPF policy was observed in DNS.',
    details: [
      ...analysis.records.map((record) => `Record: ${record}`),
      ...(hasRecord ? [] : ['No v=spf1 TXT record was returned.']),
      'SPF is inspected as published policy; no live sender-authorization test is performed.',
    ],
    findings: analysis.findings,
  };
}

async function dmarcSection(domain: string, budget?: QueryBudget): Promise<EmailDomainHealthSection> {
  const analysis = await analyzeDMARC(domain, budget);
  const hasRecord = analysis.records.length > 0;
  const status = hasRecord ? statusFromFindings(analysis.findings) : 'warning';

  return {
    key: 'dmarc',
    title: 'DMARC policy',
    status,
    summary: hasRecord
      ? analysis.findings.some((item) => item.severity === 'error')
        ? 'A DMARC record was found, but it has problems.'
        : 'A DMARC record was found and parsed.'
      : `No DMARC policy was observed at _dmarc.${domain}.`,
    details: [
      ...analysis.records.map((record) => `Record: ${record}`),
      ...(hasRecord ? [] : ['No v=DMARC1 TXT record was returned.']),
    ],
    findings: analysis.findings,
  };
}

async function dkimSection(
  domain: string,
  selector: string,
  budget?: QueryBudget
): Promise<EmailDomainHealthSection> {
  const analysis = await analyzeDKIM(domain, selector, budget);
  const found = analysis.records.length > 0;
  const status: EmailDomainHealthSection['status'] = found
    ? statusFromFindings(analysis.findings)
    : 'warning';

  return {
    key: 'dkim',
    title: `DKIM key (selector "${selector}")`,
    status,
    summary: found
      ? 'A DKIM public key was found for this selector. The signature itself was not verified.'
      : `No DKIM key was found for selector "${selector}".`,
    details: [
      `Selector lookup: ${selector}._domainkey.${domain}`,
      ...analysis.records.map((record) => `Record: ${record}`),
      'Note: finding a published key is not cryptographic signature verification.',
    ],
    findings: analysis.findings,
  };
}

async function ptrSection(domain: string, budget?: QueryBudget): Promise<EmailDomainHealthSection> {
  // PTR applies to sending hosts, not the domain. Resolve the domain's first
  // address and, when the reverse lookup is permitted, observe it.
  const a = await resolveDNS(domain, DNSRecordType.A, { budget });
  const addresses = normalizeDNSRecord(DNSRecordType.A, a.records) as string[];
  if (addresses.length === 0) {
    return {
      key: 'ptr',
      title: 'Reverse DNS (PTR) of the web host',
      status: 'info',
      summary: 'No A record was available, so no reverse DNS observation was made.',
      details: ['PTR records belong to IP addresses; the domain itself has none.'],
      findings: [],
    };
  }

  try {
    const ptr = await lookupPTR(addresses[0], budget);
    const names = ptr.ptrs;
    return {
      key: 'ptr',
      title: 'Reverse DNS (PTR) of the web host',
      status: names.length > 0 ? 'pass' : 'info',
      summary:
        names.length > 0
          ? `The address ${addresses[0]} has a PTR record. Mail-sending hosts should each have their own matching PTR.`
          : `The address ${addresses[0]} has no PTR record.`,
      details: [
        `Checked address: ${addresses[0]}`,
        ...(names.length > 0 ? names : ['No PTR record was returned.']),
        "This checks the web host only; the hosts that send this domain's mail must be checked separately.",
      ],
      findings:
        names.length > 0
          ? []
          : [
              finding(
                'PTR_ABSENT_WEBHOST',
                'info',
                'email',
                'No PTR for the observed web address',
                `${addresses[0]} has no reverse record.`,
                'Receiving servers often expect sending hosts to have PTR records. This observation is about the web host, not necessarily about the mail hosts.'
              ),
            ],
    };
  } catch {
    return {
      key: 'ptr',
      title: 'Reverse DNS (PTR) of the web host',
      status: 'info',
      summary: 'The reverse lookup could not be performed for the observed address.',
      details: [`Checked address: ${addresses[0]}`],
      findings: [],
    };
  }
}

export async function checkEmailDomainHealth(
  domain: string,
  selector: string | null,
  budget?: QueryBudget
): Promise<EmailDomainHealthResult> {
  const sections: EmailDomainHealthSection[] = [];
  const notes = [
    'This check reads DNS records only. No SMTP connection is made and no test message is sent, so it cannot confirm that mail is actually delivered.',
    'Observations come from live DNS queries at the time of the request.',
  ];

  sections.push(await mxSection(domain, budget));
  sections.push(await spfSection(domain, budget));
  sections.push(await dmarcSection(domain, budget));

  let dkimChecked = false;
  if (selector) {
    sections.push(await dkimSection(domain, selector, budget));
    dkimChecked = true;
  }

  sections.push(await ptrSection(domain, budget));

  return {
    domain,
    selector,
    dkimChecked,
    sections,
    overallStatus: worstSection(sections),
    findings: sections.flatMap((section) => section.findings),
    notes,
  };
}