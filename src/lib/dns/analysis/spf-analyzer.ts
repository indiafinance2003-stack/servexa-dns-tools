import { DNSRecordType, SPFAnalysis } from '@/types/domain';
import { resolveDNS, QueryBudget } from '@/lib/dns/resolver/dns-resolver';
import { normalizeTXTRecords } from '@/lib/dns/normalization/dns-normalizer';
import { isSpfRecord, parseSPFRecord } from '@/lib/dns/analysis/spf-parser';
import { finding } from '@/lib/dns/analysis/findings';
import { config } from '@/lib/config';

export { parseSPFRecord, isSpfRecord };

export async function analyzeSPF(domain: string, budget?: QueryBudget): Promise<SPFAnalysis> {
  const result = await resolveDNS(domain, DNSRecordType.TXT, { budget });
  const findings: SPFAnalysis['findings'] = [];

  if (result.status !== 'success' && result.status !== 'empty') {
    findings.push(
      finding(
        'SPF_LOOKUP_FAILED',
        result.status === 'nxdomain' ? 'error' : 'warning',
        'spf',
        'SPF lookup failed',
        `TXT lookup for ${domain} returned ${result.status}.`,
        'An SPF record is published as a TXT record on the sending domain. Without a successful TXT lookup, SPF cannot be inspected.',
        { evidence: { status: result.status, error: result.error } }
      )
    );
    return {
      domain,
      records: [],
      findings,
      cryptographicOrSenderTestPerformed: false,
    };
  }

  const txtRecords = normalizeTXTRecords(result.records);
  const records = txtRecords.filter(isSpfRecord);

  if (records.length === 0) {
    findings.push(
      finding(
        'SPF_MISSING',
        'error',
        'spf',
        'No SPF record',
        'No TXT record starting with v=spf1 was found.',
        'Receiving mail servers use SPF to check whether a sending host is authorized for the domain. Missing SPF typically causes SPF None.',
        { recommendation: 'Publish a single TXT record beginning with v=spf1.' }
      )
    );
    return { domain, records, findings, cryptographicOrSenderTestPerformed: false };
  }

  if (records.length > 1) {
    findings.push(
      finding(
        'SPF_MULTIPLE',
        'error',
        'spf',
        'Multiple SPF records',
        `${records.length} SPF TXT records were found. RFC 7208 allows only one.`,
        'Multiple v=spf1 records make evaluation a PermError. Combine mechanisms into a single record.',
        { evidence: { records } }
      )
    );
    return { domain, records, findings, cryptographicOrSenderTestPerformed: false };
  }

  const parsed = parseSPFRecord(records[0]);
  for (const error of parsed.errors) {
    findings.push(
      finding('SPF_SYNTAX', 'error', 'spf', 'SPF syntax issue', error, 'The SPF record could not be fully parsed according to common RFC 7208 syntax rules.', {
        evidence: { error },
      })
    );
  }

  const lookupMechanisms = parsed.mechanisms.filter((m) =>
    ['a', 'mx', 'include', 'exists', 'ptr'].includes(m.type)
  );
  const redirect = parsed.modifiers.filter((m) => m.name === 'redirect');
  const lookupCount = lookupMechanisms.length + redirect.length;
  if (lookupCount > config.MAX_SPF_INCLUDE_LOOKUPS) {
    findings.push(
      finding(
        'SPF_LOOKUP_LIMIT',
        'warning',
        'spf',
        'High DNS lookup count at this record',
        `This record contains ${lookupCount} mechanisms/modifiers that require DNS lookups. RFC 7208 limits evaluation to 10 lookups.`,
        'This tool counted lookups declared on this record only. Nested include targets were not fully expanded.',
        { evidence: { lookupCount } }
      )
    );
  }

  const allMech = parsed.mechanisms.find((m) => m.type === 'all');
  if (allMech?.qualifier === '+') {
    findings.push(
      finding(
        'SPF_PLUS_ALL',
        'error',
        'spf',
        'SPF ends with +all',
        'The record authorizes any host.',
        '+all allows any sender to pass SPF for this domain.',
        { recommendation: 'Use -all or ~all instead of +all unless this is intentional.' }
      )
    );
  } else if (allMech?.qualifier === '?') {
    findings.push(
      finding(
        'SPF_NEUTRAL_ALL',
        'warning',
        'spf',
        'SPF ends with ?all',
        'Unauthorized senders produce a Neutral result.',
        '?all is typically weaker than ~all or -all.',
        { recommendation: 'Prefer ~all while testing, then -all.' }
      )
    );
  } else if (allMech?.qualifier === '~') {
    findings.push(
      finding(
        'SPF_SOFTFAIL_ALL',
        'info',
        'spf',
        'SPF uses ~all',
        'Unauthorized senders produce SoftFail.',
        '~all is common during rollout. Many receivers treat it more weakly than -all.'
      )
    );
  } else if (allMech?.qualifier === '-') {
    findings.push(
      finding(
        'SPF_FAIL_ALL',
        'pass',
        'spf',
        'SPF uses -all',
        'Unauthorized senders produce Fail.',
        '-all is the strict terminal mechanism. This is a record observation, not a live sender test.'
      )
    );
  } else if (!allMech && redirect.length === 0) {
    findings.push(
      finding(
        'SPF_NO_ALL',
        'warning',
        'spf',
        'No all mechanism or redirect',
        'The record has no terminal all mechanism and no redirect modifier.',
        'Without all or redirect, unmatched senders default to Neutral.'
      )
    );
  }

  if (parsed.mechanisms.some((m) => m.type === 'ptr')) {
    findings.push(
      finding(
        'SPF_PTR',
        'warning',
        'spf',
        'Deprecated ptr mechanism',
        'The ptr mechanism is present.',
        'RFC 7208 recommends against ptr because it is slow and unreliable.'
      )
    );
  }

  if (parsed.valid && findings.every((f) => f.severity === 'pass' || f.severity === 'info')) {
    findings.unshift(
      finding(
        'SPF_PRESENT',
        'pass',
        'spf',
        'SPF record present',
        'A single SPF record was found and parsed.',
        'This is a syntax and configuration review. No sender IP was supplied, so authorization for a specific host was not evaluated.'
      )
    );
  }

  findings.push(
    finding(
      'SPF_NO_SENDER_TEST',
      'info',
      'spf',
      'No live sender authorization test',
      'No sender IP was supplied.',
      'This tool inspects published SPF policy. It does not simulate SMTP from a client IP unless that IP is provided.'
    )
  );

  return {
    domain,
    records,
    parsed,
    findings,
    cryptographicOrSenderTestPerformed: false,
  };
}
