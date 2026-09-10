import { ReceivedHop } from '@/types/domain';
import { classifyIP, parseIP } from '@/lib/net/ip';

function extractIps(raw: string): string[] {
  const found = new Set<string>();
  const bracketed = raw.matchAll(/\[([^\]]+)\]/g);
  for (const match of bracketed) {
    const candidate = match[1].replace(/^IPv6:/i, '');
    if (parseIP(candidate)) found.add(candidate);
  }
  const bare = raw.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  for (const match of bare) {
    if (parseIP(match[0])) found.add(match[0]);
  }
  // RFC-style Received fields commonly bracket IPv6 literals, but some
  // relays emit an unbracketed literal in comments or host clauses.
  const ipv6 = raw.matchAll(/(?<![0-9a-f:])(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}(?![0-9a-f:])/gi);
  for (const match of ipv6) {
    if (parseIP(match[0])) found.add(match[0]);
  }
  return [...found];
}

export function parseReceivedHeader(rawHeader: string, index: number): ReceivedHop {
  const hop: ReceivedHop = {
    index,
    ipAddresses: [],
    hostnames: [],
    parseable: false,
    internalIps: [],
    publicIps: [],
    rawContent: rawHeader,
  };

  const fromMatch = /\bfrom\s+([^\s;(]+)/i.exec(rawHeader);
  if (fromMatch) hop.from = fromMatch[1];

  const byMatch = /\bby\s+([^\s;(]+)/i.exec(rawHeader);
  if (byMatch) hop.by = byMatch[1];

  const withMatch = /\bwith\s+([^\s;]+)/i.exec(rawHeader);
  if (withMatch) {
    hop.with = withMatch[1];
    hop.protocol = withMatch[1];
  }

  const idMatch = /\bid\s+([^\s;]+)/i.exec(rawHeader);
  if (idMatch) hop.id = idMatch[1];

  const timestampMatch = /;\s*([^;]+)$/.exec(rawHeader);
  if (timestampMatch) {
    hop.timestamp = timestampMatch[1].trim();
  }

  hop.ipAddresses = extractIps(rawHeader);
  const hostCandidates = [hop.from, hop.by].filter((value): value is string => Boolean(value));
  hop.hostnames = hostCandidates.filter((value) => !parseIP(value.replace(/^\[|\]$/g, '')));

  for (const ip of hop.ipAddresses) {
    const parsed = parseIP(ip);
    if (!parsed) continue;
    const classification = classifyIP(parsed);
    if (classification === 'public') hop.publicIps.push(ip);
    else hop.internalIps.push(ip);
  }

  hop.parseable = Boolean(hop.from || hop.by || hop.timestamp || hop.ipAddresses.length);
  return hop;
}

export function parseReceivedHeaders(values: string[]): ReceivedHop[] {
  return values.map((value, index) => parseReceivedHeader(value, index));
}
