import { CANONICAL_HEADER_ALIASES } from '@/lib/web/security-headers';

/**
 * Basic HTTP header normalization helpers used by the web diagnostics.
 *
 * HTTP header names are case-insensitive per RFC 9110, but the UI often
 * wants stable capitalization for display. This module keeps the mapping
 * logic close to the web diagnostics layer instead of duplicating it across
 * the security-header and response-header tools.
 */

const normalizedCache = new Map<string, string>();

function normalizeKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  let existing = normalizedCache.get(trimmed);
  if (existing !== undefined) return existing;

  const lower = trimmed.toLowerCase();
  const canonical = CANONICAL_HEADER_ALIASES.get(lower) ?? lower;
  const result = canonical.split('-').map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join('-');
  normalizedCache.set(trimmed, result);
  return result;
}

export interface HeaderEntry {
  name: string;
  value: string;
}

export function normalizeHeaderEntry(raw: string | HeaderEntry): HeaderEntry {
  if (typeof raw === 'string') {
    const separator = raw.indexOf(':');
    if (separator < 0) return { name: normalizeKey(raw), value: raw };
    return {
      name: normalizeKey(raw.slice(0, separator)),
      value: raw.slice(separator + 1),
    };
  }
  return { name: normalizeKey(raw.name), value: raw.value };
}

/**
 * Returns header names in a stable, presentable order. Unknown headers are
 * sorted alphabetically after the recognized security/transport headers.
 */
export function sortedHeaderNames(headers: Iterable<string | HeaderEntry>): Array<string | HeaderEntry> {
  const entries = Array.isArray(headers) ? headers : Array.from(headers);
  const withIndex = entries.map((header, index) => ({ header, index }));
  withIndex.sort((a, b) => {
    const nameA = typeof a.header === 'string' ? normalizeKey(a.header) : normalizeKey(a.header.name);
    const nameB = typeof b.header === 'string' ? normalizeKey(b.header) : normalizeKey(b.header.name);
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return a.index - b.index;
  });
  return withIndex.map((item) => item.header);
}

export function headerValueJoin(values: Array<string | readonly string[]>): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .join(', ');
}
