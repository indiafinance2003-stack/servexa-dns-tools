export interface ParsedIPv4 {
  version: 4;
  octets: number[];
  canonical: string;
}

export interface ParsedIPv6 {
  version: 6;
  groups: number[];
  canonical: string;
}

export type ParsedIP = ParsedIPv4 | ParsedIPv6;

export function parseIPv4(input: string): ParsedIPv4 | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    octets.push(value);
  }
  return { version: 4, octets, canonical: octets.join('.') };
}

function expandIPv6(input: string): number[] | null {
  if (input.includes('%')) {
    input = input.slice(0, input.indexOf('%'));
  }
  if ((input.match(/::/g) || []).length > 1) return null;
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    if (lastColon < 0) return null;
    const v4 = parseIPv4(input.slice(lastColon + 1));
    if (!v4) return null;
    const prefix = input.slice(0, lastColon + 1);
    const hi = (v4.octets[0] << 8) | v4.octets[1];
    const lo = (v4.octets[2] << 8) | v4.octets[3];
    input = `${prefix}${hi.toString(16)}:${lo.toString(16)}`;
  }
  const [head, tail] = input.split('::');
  const parseGroups = (part: string | undefined): number[] | null => {
    if (!part) return [];
    const items = part.split(':');
    const groups: number[] = [];
    for (const item of items) {
      if (item === '') return null;
      if (!/^[0-9a-fA-F]{1,4}$/.test(item)) return null;
      groups.push(parseInt(item, 16));
    }
    return groups;
  };
  if (input.includes('::')) {
    const left = parseGroups(head);
    const right = parseGroups(tail);
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    return [...left, ...Array(missing).fill(0), ...right];
  }
  const groups = parseGroups(input);
  if (!groups || groups.length !== 8) return null;
  return groups;
}

export function parseIPv6(input: string): ParsedIPv6 | null {
  const groups = expandIPv6(input);
  if (!groups) return null;
  return {
    version: 6,
    groups,
    canonical: groups.map((g) => g.toString(16)).join(':'),
  };
}

export function parseIP(input: string): ParsedIP | null {
  const trimmed = input.trim();
  if (trimmed.includes(':')) return parseIPv6(trimmed);
  return parseIPv4(trimmed);
}

function ipv4ToInt(octets: number[]): number {
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function inCidr(ip: number, prefix: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (prefix & mask);
}

export function isLoopbackIP(ip: ParsedIP): boolean {
  if (ip.version === 4) return ip.octets[0] === 127;
  return ip.groups.every((g, i) => (i === 7 ? g === 1 : g === 0));
}

export function isPrivateIP(ip: ParsedIP): boolean {
  if (ip.version === 4) {
    const n = ipv4ToInt(ip.octets);
    return (
      inCidr(n, ipv4ToInt([10, 0, 0, 0]), 8) ||
      inCidr(n, ipv4ToInt([172, 16, 0, 0]), 12) ||
      inCidr(n, ipv4ToInt([192, 168, 0, 0]), 16) ||
      inCidr(n, ipv4ToInt([100, 64, 0, 0]), 10)
    );
  }
  return ip.groups[0] >= 0xfc00 && ip.groups[0] <= 0xfdff;
}

export function isLinkLocalIP(ip: ParsedIP): boolean {
  if (ip.version === 4) {
    return ip.octets[0] === 169 && ip.octets[1] === 254;
  }
  return (ip.groups[0] & 0xffc0) === 0xfe80;
}

export function isUnspecifiedIP(ip: ParsedIP): boolean {
  if (ip.version === 4) return ip.octets.every((o) => o === 0);
  return ip.groups.every((g) => g === 0);
}

export function isMulticastIP(ip: ParsedIP): boolean {
  if (ip.version === 4) return ip.octets[0] >= 224 && ip.octets[0] <= 239;
  return (ip.groups[0] & 0xff00) === 0xff00;
}

export function isMappedIPv4(ip: ParsedIP): ParsedIPv4 | null {
  if (ip.version !== 6) return null;
  const mapped =
    ip.groups[0] === 0 &&
    ip.groups[1] === 0 &&
    ip.groups[2] === 0 &&
    ip.groups[3] === 0 &&
    ip.groups[4] === 0 &&
    ip.groups[5] === 0xffff;
  if (!mapped) return null;
  const hi = ip.groups[6];
  const lo = ip.groups[7];
  return {
    version: 4,
    octets: [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255],
    canonical: `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`,
  };
}

export function classifyIP(ip: ParsedIP): 'public' | 'loopback' | 'private' | 'link-local' | 'unspecified' | 'multicast' | 'reserved' {
  const mapped = isMappedIPv4(ip);
  if (mapped) return classifyIP(mapped);
  if (isUnspecifiedIP(ip)) return 'unspecified';
  if (isLoopbackIP(ip)) return 'loopback';
  if (isLinkLocalIP(ip)) return 'link-local';
  if (isPrivateIP(ip)) return 'private';
  if (isMulticastIP(ip)) return 'multicast';
  if (ip.version === 4 && ip.octets[0] >= 240) return 'reserved';
  return 'public';
}

export function isPublicUnicastIP(ip: ParsedIP): boolean {
  return classifyIP(ip) === 'public';
}
