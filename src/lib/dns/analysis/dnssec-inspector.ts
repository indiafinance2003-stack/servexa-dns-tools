import { DnssecInspection } from '@/types/domain';
import { QueryBudget } from '@/lib/dns/resolver/dns-resolver';
import { finding } from '@/lib/dns/analysis/findings';

/**
 * DNSSEC inspection.
 *
 * This tool never claims whether a zone is signed: Node's built-in resolver
 * cannot return DS, DNSKEY, or RRSIG records, so the only honest determination
 * is "could not be determined". No cryptographic chain-of-trust validation is
 * performed either, and this module says so instead of implying absence.
 */
export async function inspectDnssec(_domain: string, _budget?: QueryBudget): Promise<DnssecInspection> {
  return {
    determination: 'could_not_be_determined',
    dsRecords: [],
    dnskeyRecords: [],
    rrsigObserved: false,
    cryptographicValidationPerformed: false,
    notes: [
      'This tool does not query DS, DNSKEY, or RRSIG records because its resolver cannot return those types.',
      'Cryptographic DNSSEC validation (signature checking, chain of trust) is not performed by this application.',
    ],
    findings: [
      finding(
        'DNSSEC_NOT_INSPECTED',
        'info',
        'dnssec',
        'DNSSEC state is not determined',
        'No DS, DNSKEY, or RRSIG records were queried.',
        'This tool\u2019s resolver does not support DNSSEC-related record types and no cryptographic DNSSEC validation is performed. An absent finding here does not indicate an unsigned zone.',
        { evidence: { queriedRecordTypes: [] } }
      ),
    ],
  };
}