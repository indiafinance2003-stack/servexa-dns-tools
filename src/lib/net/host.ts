import { parseIP } from '@/lib/net/ip';

/** Shared helpers for host strings. Kept dependency-free so both the HTTP
 * client, the TLS inspector, and the validators agree on one implementation. */

export function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

export function isIPLiteralHostName(hostname: string): boolean {
  return parseIP(stripBrackets(hostname)) !== null;
}

/** Brackets an IPv6 literal for use in a Host header or URL authority. */
export function formatHostForAuthority(hostname: string, isIPLiteral: boolean): string {
  return isIPLiteral && hostname.includes(':') ? `[${hostname}]` : hostname;
}
