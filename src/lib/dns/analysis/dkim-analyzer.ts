import { DKIMAnalysis } from '@/types/domain';
import { DNSRecordType } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeTXTRecords } from '@/lib/dns/normalization/dns-normalizer';
import { isDkimDnsRecord, parseDKIMDnsRecord, parseDKIMSignatureHeader } from '@/lib/dns/analysis/dkim-parser';
import { finding } from '@/lib/dns/analysis/findings';

export { parseDKIMDnsRecord, parseDKIMSignatureHeader, isDkimDnsRecord };

export async function analyzeDKIM(
  domain: string,
  selector: string,
  budget?: QueryBudget
): Promise<DKIMAnalysis> {
  const lookupName = `${selector}._domainkey.${domain}`;
  const result = await resolveDNS(lookupName, DNSRecordType.TXT, { budget });
  const findings: DKIMAnalysis['findings'] = [];

  if (result.status !== 'success' && result.status !== 'empty') {
    findings.push(
      finding(
        'DKIM_LOOKUP_FAILED',
        result.status === 'nxdomain' ? 'error' : 'warning',
        'dkim',
        'DKIM lookup failed',
        `TXT lookup for ${lookupName} returned ${result.status}.`,
        'DKIM public keys are published at selector._domainkey.domain.',
        { evidence: { status: result.status, error: result.error } }
      )
    );
    return {
      domain,
      selector,
      lookupName,
      records: [],
      findings,
      cryptographicVerification: 'not_performed',
    };
  }

  const records = normalizeTXTRecords(result.records).filter(isDkimDnsRecord);
  if (records.length === 0) {
    findings.push(
      finding(
        'DKIM_MISSING',
        'error',
        'dkim',
        'No DKIM key record',
        `No DKIM TXT record was found at ${lookupName}.`,
        'The selector may be unused, misspelled, or unpublished. Cryptographic verification of signatures was not attempted.',
        { recommendation: 'Confirm the selector from a DKIM-Signature header (s=) and publish a v=DKIM1 record.' }
      )
    );
    return { domain, selector, lookupName, records, findings, cryptographicVerification: 'not_performed' };
  }

  const parsed = parseDKIMDnsRecord(records[0]);
  for (const error of parsed.errors) {
    findings.push(
      finding('DKIM_MALFORMED', 'error', 'dkim', 'DKIM key record issue', error, 'The published key record could not be fully interpreted.', {
        evidence: { error },
      })
    );
  }

  if (parsed.publicKeyPresent) {
    findings.push(
      finding(
        'DKIM_KEY_PRESENT',
        'pass',
        'dkim',
        'DKIM public key published',
        `Selector ${selector} has a public key (k=${parsed.keyType}).`,
        'Signature present on mail is a separate question. Cryptographic verification not performed.'
      )
    );
  }

  if (parsed.flags?.includes('y')) {
    findings.push(
      finding(
        'DKIM_TESTING_FLAG',
        'info',
        'dkim',
        'Testing flag (t=y)',
        'The key record includes t=y.',
        'Some verifiers treat this as a testing selector and may not consider failures definitive.'
      )
    );
  }

  if (parsed.service && parsed.service !== '*' && parsed.service !== 'email') {
    findings.push(
      finding(
        'DKIM_SERVICE_RESTRICTED',
        'info',
        'dkim',
        `Service type s=${parsed.service}`,
        'The key is restricted to a service type other than the usual email/* values.',
        'Receivers may ignore this key for email if s= does not include email.'
      )
    );
  }

  findings.push(
    finding(
      'DKIM_NO_CRYPTO',
      'info',
      'dkim',
      'Cryptographic verification not performed',
      'This tool inspects the published key and, when present, DKIM-Signature header fields.',
      'If a signature is present on a message, cryptographic verification not performed.'
    )
  );

  return {
    domain,
    selector,
    lookupName,
    records,
    parsed,
    findings,
    cryptographicVerification: 'not_performed',
  };
}
