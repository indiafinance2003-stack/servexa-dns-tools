import { DnssecInspection } from '@/types/domain';
import { QueryBudget, resolveSpecial } from '@/lib/dns/resolver/dns-resolver';
import { finding } from '@/lib/dns/analysis/findings';

export async function inspectDnssec(domain: string, budget?: QueryBudget): Promise<DnssecInspection> {
  const ds = await resolveSpecial(domain, 'DS', { budget });
  const dnskey = await resolveSpecial(domain, 'DNSKEY', { budget });
  const rrsig = await resolveSpecial(domain, 'RRSIG', { budget });

  const notes: string[] = [
    'This inspection looks up DS, DNSKEY, and RRSIG records when the resolver and library support those types.',
    'Cryptographic DNSSEC validation (signature checking, chain of trust) is not performed by this application.',
  ];

  const findings: DnssecInspection['findings'] = [];
  const dsFound = ds.status === 'success' && ds.records.length > 0;
  const dnskeyFound = dnskey.status === 'success' && dnskey.records.length > 0;
  const rrsigFound = rrsig.status === 'success' && rrsig.records.length > 0;

  const lookupFailed = [ds, dnskey, rrsig].some(
    (item) => item.status === 'timeout' || item.status === 'refused' || item.status === 'error'
  );
  const servfail = [ds, dnskey, rrsig].some((item) => item.status === 'servfail');

  let determination: DnssecInspection['determination'];
  if (dsFound || dnskeyFound) {
    determination = 'appears_enabled';
    findings.push(
      finding(
        'DNSSEC_RECORDS_PRESENT',
        'info',
        'dnssec',
        'DNSSEC-related records were observed',
        [
          dsFound ? 'DS present' : 'DS not observed',
          dnskeyFound ? 'DNSKEY present' : 'DNSKEY not observed',
          rrsigFound ? 'RRSIG present' : 'RRSIG not observed from this lookup',
        ].join('; '),
        'Presence of DS/DNSKEY suggests DNSSEC is configured. This is not a cryptographic validation result.'
      )
    );
  } else if (servfail && !dsFound && !dnskeyFound) {
    determination = 'possible_validation_failure';
    notes.push('SERVFAIL can have many causes. DNSSEC validation failure is only one possibility.');
    findings.push(
      finding(
        'DNSSEC_SERVFAIL',
        'warning',
        'dnssec',
        'Resolver returned SERVFAIL for DNSSEC-related queries',
        'SERVFAIL was observed while querying DS/DNSKEY/RRSIG.',
        'This tool cannot distinguish a DNSSEC validation failure from other resolver or zone errors. Cryptographic validation was not performed.'
      )
    );
  } else if (lookupFailed) {
    determination = 'could_not_be_determined';
    findings.push(
      finding(
        'DNSSEC_UNDETERMINED',
        'info',
        'dnssec',
        'DNSSEC state could not be determined',
        'DS/DNSKEY lookups did not complete successfully and no DNSSEC records were observed.',
        'The resolver or Node DNS library may not return these record types. Absence of evidence is not evidence of absence.'
      )
    );
  } else {
    determination = 'appears_absent';
    findings.push(
      finding(
        'DNSSEC_ABSENT',
        'info',
        'dnssec',
        'DNSSEC appears absent',
        'No DS or DNSKEY records were returned (NOERROR/NODATA or empty).',
        'This observation is based on record presence only, not cryptographic validation.'
      )
    );
  }

  return {
    determination,
    dsRecords: ds.records,
    dnskeyRecords: dnskey.records,
    rrsigObserved: rrsigFound,
    cryptographicValidationPerformed: false,
    notes,
    findings,
  };
}
