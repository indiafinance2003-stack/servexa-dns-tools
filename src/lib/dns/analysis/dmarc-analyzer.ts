import { DMARCAnalysis } from '@/types/domain';
import { DNSRecordType } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeTXTRecords } from '@/lib/dns/normalization/dns-normalizer';
import { isDmarcRecord, parseDMARCRecord } from '@/lib/dns/analysis/dmarc-parser';
import { finding } from '@/lib/dns/analysis/findings';

export { parseDMARCRecord, isDmarcRecord };

export async function analyzeDMARC(domain: string, budget?: QueryBudget): Promise<DMARCAnalysis> {
  const lookupName = `_dmarc.${domain}`;
  const result = await resolveDNS(lookupName, DNSRecordType.TXT, { budget });
  const findings: DMARCAnalysis['findings'] = [];

  const failedStatuses: ReadonlySet<string> = new Set(['servfail', 'refused', 'timeout', 'error']);
  if (failedStatuses.has(result.status)) {
    findings.push(
      finding(
        'DMARC_LOOKUP_FAILED',
        'error',
        'dmarc',
        'DMARC lookup failed',
        `TXT lookup for ${lookupName} returned ${result.status}.`,
        'DMARC policies are published at _dmarc.domain as TXT records.',
        { evidence: { status: result.status, error: result.error } }
      )
    );
    return { domain, lookupName, records: [], findings };
  }

  const records = normalizeTXTRecords(result.records).filter(isDmarcRecord);

  if (records.length === 0) {
    findings.push(
      finding(
        'DMARC_MISSING',
        'error',
        'dmarc',
        'No DMARC record',
        `No v=DMARC1 TXT record was found at ${lookupName}.`,
        'Without DMARC, receivers have no published policy for handling failed authentication.',
        { recommendation: 'Publish a DMARC record at _dmarc.example.com starting with v=DMARC1; p=none or stricter.', evidence: { lookupStatus: result.status } }
      )
    );
    return { domain, lookupName, records, findings };
  }

  if (records.length > 1) {
    findings.push(
      finding(
        'DMARC_MULTIPLE',
        'error',
        'dmarc',
        'Multiple DMARC records',
        `${records.length} DMARC records were found.`,
        'Receivers may ignore DMARC entirely when more than one policy record exists.',
        { evidence: { records } }
      )
    );
    return { domain, lookupName, records, findings };
  }

  const parsed = parseDMARCRecord(records[0]);
  for (const error of parsed.errors) {
    findings.push(
      finding('DMARC_MALFORMED', 'error', 'dmarc', 'Malformed DMARC record', error, 'One or more DMARC tags could not be interpreted.', {
        evidence: { error },
      })
    );
  }

  if (parsed.policy === 'none') {
    findings.push(
      finding(
        'DMARC_POLICY_NONE',
        'warning',
        'dmarc',
        'Policy is p=none',
        'The domain requests no special handling of unauthenticated mail.',
        'p=none is useful for monitoring. It does not instruct receivers to quarantine or reject failing messages.',
        { recommendation: 'After reviewing aggregate reports, consider p=quarantine or p=reject.' }
      )
    );
  } else if (parsed.policy === 'quarantine') {
    findings.push(
      finding(
        'DMARC_POLICY_QUARANTINE',
        'info',
        'dmarc',
        'Policy is p=quarantine',
        'Receivers are asked to treat failing messages with suspicion.',
        'This is stronger than p=none and weaker than p=reject.'
      )
    );
  } else if (parsed.policy === 'reject') {
    findings.push(
      finding(
        'DMARC_POLICY_REJECT',
        'pass',
        'dmarc',
        'Policy is p=reject',
        'Receivers are asked to reject unauthenticated mail claiming this domain.',
        'This is the strictest common DMARC policy. Effectiveness still depends on receiver implementation.'
      )
    );
  }

  if (parsed.percentage !== undefined && parsed.percentage < 100) {
    findings.push(
      finding(
        'DMARC_PCT',
        'warning',
        'dmarc',
        `pct=${parsed.percentage}`,
        `The policy applies to approximately ${parsed.percentage}% of failing messages.`,
        'pct less than 100 is a rollout control. Remaining mail may be treated as if policy were none.'
      )
    );
  }

  if (!parsed.rua || parsed.rua.length === 0) {
    findings.push(
      finding(
        'DMARC_NO_RUA',
        'info',
        'dmarc',
        'No aggregate reporting (rua)',
        'No rua= URI was published.',
        'Aggregate reports help operators see authentication results. They are optional but useful.'
      )
    );
  } else {
    findings.push(
      finding(
        'DMARC_RUA',
        'pass',
        'dmarc',
        'Aggregate reporting configured',
        `rua=${parsed.rua.join(', ')}`,
        'This tool does not verify that the reporting mailbox exists or that external destinations are authorized via reporting records.'
      )
    );
  }

  if (parsed.dkimAlignment === 's' || parsed.spfAlignment === 's') {
    findings.push(
      finding(
        'DMARC_STRICT_ALIGNMENT',
        'info',
        'dmarc',
        'Strict alignment requested',
        `adkim=${parsed.adkim ?? 'r (default)'} aspf=${parsed.aspf ?? 'r (default)'}`,
        'Strict alignment requires the authenticated domain to match the From domain exactly, not merely share an organizational domain.'
      )
    );
  }

  if (parsed.valid) {
    findings.unshift(
      finding(
        'DMARC_PRESENT',
        'pass',
        'dmarc',
        'DMARC record present',
        'A DMARC policy record was found and parsed.',
        'This is a published-policy review, not a verdict on any specific message.'
      )
    );
  }

  return { domain, lookupName, records, parsed, findings };
}
