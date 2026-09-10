import { DNSRecordType, ResolverComparison, ResolverObservation } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeDNSRecord } from '@/lib/dns/normalization/dns-normalizer';

export const PUBLIC_RESOLVERS = [
  { name: 'Cloudflare', server: '1.1.1.1' },
  { name: 'Google', server: '8.8.8.8' },
  { name: 'Quad9', server: '9.9.9.9' },
  { name: 'OpenDNS', server: '208.67.222.222' },
] as const;

function serializeAnswers(answers: unknown[]): string {
  try {
    return JSON.stringify(answers);
  } catch {
    return String(answers);
  }
}

export async function compareResolvers(
  domain: string,
  recordType: DNSRecordType,
  budget?: QueryBudget
): Promise<ResolverComparison> {
  const observations: ResolverObservation[] = [];

  for (const resolver of PUBLIC_RESOLVERS) {
    try {
      const result = await resolveDNS(domain, recordType, {
        servers: [resolver.server],
        budget,
      });
      observations.push({
        resolver: resolver.name,
        server: resolver.server,
        status: result.status,
        answers: normalizeDNSRecord(recordType, result.records),
        error: result.error,
        queryTime: result.queryTime,
      });
    } catch (error) {
      observations.push({
        resolver: resolver.name,
        server: resolver.server,
        status: 'error',
        answers: [],
        error: error instanceof Error ? error.message : 'Resolver query failed',
        queryTime: 0,
      });
    }
  }

  const differences: string[] = [];
  const success = observations.filter((item) => item.status === 'success');
  if (success.length > 1) {
    const baseline = serializeAnswers(success[0].answers);
    for (const item of success.slice(1)) {
      if (serializeAnswers(item.answers) !== baseline) {
        differences.push(`${item.resolver} returned a different answer set than ${success[0].resolver}.`);
      }
    }
  }

  const statuses = new Set(observations.map((item) => item.status));
  if (statuses.size > 1) {
    differences.push('Selected resolvers did not all return the same status.');
  }

  const unavailable = observations.filter((item) => item.status === 'timeout' || item.status === 'error' || item.status === 'refused');
  for (const item of unavailable) {
    differences.push(`${item.resolver} (${item.server}) was unavailable or did not return a usable answer.`);
  }

  return {
    domain,
    recordType,
    observations,
    differences,
    terminology:
      'Observed responses from selected public resolvers. This is not a global propagation measurement.',
  };
}
