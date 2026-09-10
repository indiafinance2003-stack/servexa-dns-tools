import { ReportedAuthResult } from '@/types/domain';

export function parseAuthenticationResults(values: string[]): ReportedAuthResult[] {
  const results: ReportedAuthResult[] = [];

  for (const raw of values) {
    const compact = raw.replace(/\s+/g, ' ').trim();
    if (!compact) continue;

    const parts = compact.split(';').map((part) => part.trim()).filter(Boolean);
    let authservId: string | undefined;
    const rest: string[] = [];

    for (const part of parts) {
      if (!authservId && !part.includes('=') && !/\b(spf|dkim|dmarc|arc|auth|iprev|smtp)\b/i.test(part.split(' ')[0])) {
        authservId = part.split(' ')[0];
        continue;
      }
      rest.push(part);
    }

    if (rest.length === 0 && compact.includes('=')) {
      rest.push(compact);
    }

    for (const spec of rest) {
      const methodMatch = /^(spf|dkim|dmarc|arc|auth|iprev|dmarc)\s*=\s*([a-z0-9_-]+)/i.exec(spec);
      if (!methodMatch) continue;
      const properties: Record<string, string> = {};
      const propMatches = spec.matchAll(/\b([a-z0-9.]+)=([^\s;]+)/gi);
      for (const match of propMatches) {
        if (match[1].toLowerCase() === methodMatch[1].toLowerCase()) continue;
        properties[match[1].toLowerCase()] = match[2];
      }
      results.push({
        authservId,
        method: methodMatch[1].toLowerCase(),
        result: methodMatch[2].toLowerCase(),
        properties,
        raw: spec,
      });
    }
  }

  return results;
}
