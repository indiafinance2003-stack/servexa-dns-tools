import { DNSRecordType, PropagationCheckResult, PropagationResolverResult } from '@/types/domain';
import { compareResolvers } from '@/lib/dns/analysis/resolver-comparison';
import { config } from '@/lib/config';
import { finding } from '@/lib/dns/analysis/findings';

/**
 * DNS propagation comparison across selected public resolvers.
 *
 * Reuses the existing resolver-comparison engine rather than duplicating DNS
 * query logic. Each queried server counts against the caller's query budget,
 * so one request cannot trigger uncontrolled DNS traffic. Resolver identity is
 * only ever the operator-published name and address; no geography is invented.
 */

export async function checkPropagation(
  domain: string,
  recordType: DNSRecordType,
  budget?: Parameters<typeof compareResolvers>[2]
): Promise<PropagationCheckResult> {
  const comparison = await compareResolvers(domain, recordType, budget);

  const results: PropagationResolverResult[] = comparison.observations.map((obs) => ({
    resolver: obs.resolver,
    server: obs.server,
    status: obs.status,
    answers: obs.answers.map((answer) => String(answer)),
    ...(obs.error ? { error: obs.error } : {}),
    queryTimeMs: obs.queryTime,
  }));

  const successful = results.filter((item) => item.status === 'success');
  const valueSets = successful.map((item) => [...new Set(item.answers)].sort().join('\n'));
  const uniqueAnswerSets = [...new Set(valueSets)];

  const consensus: string[] =
    uniqueAnswerSets.length === 1 && successful.length > 0 ? successful[0].answers : [];
  const divergent: string[] =
    uniqueAnswerSets.length > 1
      ? [...new Set(successful.flatMap((item) => item.answers))].filter(
          (answer) => !successful.every((item) => item.answers.includes(answer))
        )
      : [];

  const agreement = successful.length > 0 && uniqueAnswerSets.length === 1;
  const responseRate = results.length > 0 ? successful.length / results.length : 0;

  const findings: PropagationCheckResult['findings'] = [];

  if (successful.length === 0) {
    findings.push(
      finding(
        'PROPAGATION_NO_ANSWERS',
        'error',
        'propagation',
        'No resolver returned a usable answer',
        `None of the ${results.length} queried resolvers answered successfully for ${recordType} ${domain}.`,
        'The domain may not publish this record type, may not exist, or the resolvers may be unreachable from this network.'
      )
    );
  } else if (agreement) {
    findings.push(
      finding(
        'PROPAGATION_AGREEMENT',
        'pass',
        'propagation',
        'All responding resolvers agree',
        `${successful.length} of ${results.length} queried resolvers returned the same ${recordType} answer set.`,
        'All resolvers that answered successfully returned identical answers.'
      )
    );
  } else {
    findings.push(
      finding(
        'PROPAGATION_DIVERGENCE',
        'warning',
        'propagation',
        'Resolvers returned different answers',
        `${successful.length} of ${results.length} responding resolvers returned differing ${recordType} answers.`,
        'Divergence is expected during DNS changes while caches expire. If it persists, check that all authoritative nameservers serve identical data.'
      )
    );
  }

  if (responseRate < 1 && successful.length > 0) {
    findings.push(
      finding(
        'PROPAGATION_PARTIAL_RESPONSE',
        'info',
        'propagation',
        'Some queried resolvers did not answer',
        `${results.length - successful.length} of ${results.length} resolvers timed out, refused, or errored.`,
        'Partial responses are common when a resolver is slow or rate-limits third-party queries.'
      )
    );
  }

  const notes = [
    `Observed responses from ${results.length} public resolvers. This is not a measurement of worldwide propagation, latency, or what every user on the internet sees.`,
    `Resolver identity is the operator-published name and IP address only; geographic location is not claimed.`,
    `Each resolver query counts against the request's DNS query budget (limit ${config.MAX_DNS_QUERIES_PER_REQUEST}).`,
  ];

  return {
    domain,
    recordType,
    results,
    consensus,
    divergent,
    agreement,
    responseRate,
    findings,
    notes,
  };
}
