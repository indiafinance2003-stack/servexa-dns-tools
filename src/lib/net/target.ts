import { BlockedTargetError, ValidationError } from '@/lib/errors/app-error';
import { classifyIP, parseIP } from '@/lib/net/ip';
import { normalizeHostname, validateDomain } from '@/lib/validation/domain-validator';

/**
 * Validation of user-supplied web targets for the outbound diagnostics tools
 * (SSL checker, HTTP header checkers, website availability, security headers).
 *
 * Everything in this module is pure: it never performs network I/O. That keeps
 * the rules that protect the service from SSRF unit-testable and keeps the
 * "validate, then connect to the validated address" flow in one place.
 *
 * Deliberate restrictions:
 *  - only the http and https schemes;
 *  - only ports 80 and 443 (Ravelyth is a diagnostics platform, not a port
 *    scanner);
 *  - internal / loopback / link-local / multicast / reserved addresses are
 *    rejected, both as literals and (later) as DNS answers;
 *  - legacy numeric host forms (2130706433, 0x7f000001, 0177.0.0.1) are
 *    rejected because some resolvers map them onto loopback addresses.
 */

export const ALLOWED_WEB_PORTS = [80, 443] as const;
export type WebProtocol = 'http' | 'https';

const MAX_INPUT_LENGTH = 2048;
const MAX_PATH_LENGTH = 512;
const MAX_HOST_LENGTH = 253;

export interface WebTarget {
  /** The raw value the user submitted (trimmed). */
  input: string;
  /** Lowercase hostname without a trailing dot; IPv6 literals are unbracketed. */
  hostname: string;
  port: number;
  protocol: WebProtocol;
  /** Value for the Host header and TLS SNI (IPv6 literals are bracketed). */
  hostHeader: string;
  /** Host used for certificate identity checks. */
  identityHost: string;
  isIPLiteral: boolean;
  explicitScheme: boolean;
  /** Request path + query, already length-checked. */
  path: string;
}

export interface WebTargetOptions {
  defaultProtocol?: WebProtocol;
  allowHttp?: boolean;
}

const NUMERIC_LABEL = /^[0-9]+$/;
const HEX_LABEL = /^0x[0-9a-f]+$/i;

/**
 * Rejects hostname shapes that `getaddrinfo` may interpret as numbers rather
 * than names. A public hostname always has an alphabetic or IDN top-level
 * label, so a numeric-only final label can only be a legacy address form.
 */
function assertHostnameNotNumeric(hostname: string): void {
  const labels = hostname.split('.');
  const last = labels[labels.length - 1] ?? '';
  if (
    NUMERIC_LABEL.test(last) ||
    HEX_LABEL.test(last) ||
    NUMERIC_LABEL.test(hostname) ||
    HEX_LABEL.test(hostname)
  ) {
    throw new BlockedTargetError(
      'Numeric-only host names are not supported. Enter a public domain name or a normal IP address.'
    );
  }
}

function rejectNonPublicIP(hostname: string): void {
  const parsed = parseIP(hostname);
  if (!parsed) return;
  const classification = classifyIP(parsed);
  if (classification === 'public') return;
  throw new BlockedTargetError(
    `Targets in the ${classification} address range are not supported. Ravelyth only tests publicly reachable hosts.`
  );
}

/**
 * Validates a hostname (domain name or IP literal) that a request is going to
 * connect to. Used for user input, redirect destinations, and RDAP endpoints.
 */
export function assertSafeHostname(rawHostname: string): { hostname: string; isIPLiteral: boolean } {
  const unwrapped =
    rawHostname.startsWith('[') && rawHostname.endsWith(']')
      ? rawHostname.slice(1, -1)
      : rawHostname;
  const hostname = normalizeHostname(unwrapped);
  if (!hostname) {
    throw new ValidationError('Target host is required');
  }
  if (hostname.length > MAX_HOST_LENGTH) {
    throw new ValidationError(`Host exceeds ${MAX_HOST_LENGTH} characters`);
  }
  const parsed = parseIP(hostname);
  if (parsed) {
    rejectNonPublicIP(hostname);
    return { hostname, isIPLiteral: true };
  }
  assertHostnameNotNumeric(hostname);
  // Reuses the same domain rules as the DNS tools (blocks localhost, .local,
  // .internal, single-label names, and malformed labels).
  validateDomain(hostname);
  return { hostname, isIPLiteral: false };
}

function splitHostPort(authority: string): { host: string; port?: string } {
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    if (end === -1) throw new ValidationError('Invalid IPv6 literal in target');
    const host = authority.slice(1, end);
    const rest = authority.slice(end + 1);
    if (rest && !rest.startsWith(':')) throw new ValidationError('Invalid target host');
    return { host, port: rest ? rest.slice(1) : undefined };
  }
  const firstColon = authority.indexOf(':');
  const lastColon = authority.lastIndexOf(':');
  // More than one colon without brackets means a bare IPv6 literal.
  if (firstColon !== lastColon) return { host: authority };
  if (lastColon === -1) return { host: authority };
  return { host: authority.slice(0, lastColon), port: authority.slice(lastColon + 1) };
}

function resolvePort(port: string | undefined, explicitDefault: number): number {
  if (port === undefined || port === '') return explicitDefault;
  if (!/^\d{1,5}$/.test(port)) {
    throw new ValidationError('Target port must be numeric');
  }
  const value = Number(port);
  if (value !== 80 && value !== 443) {
    throw new BlockedTargetError(
      'Only ports 80 (HTTP) and 443 (HTTPS) can be tested. Ravelyth is not a port scanner.'
    );
  }
  return value;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  if (path.length > MAX_PATH_LENGTH) {
    throw new ValidationError(`Target path exceeds ${MAX_PATH_LENGTH} characters`);
  }
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Parses a user-supplied hostname, URL, or "host:port" value into a validated
 * target. Throws ValidationError (bad input) or BlockedTargetError (in scope
 * but deliberately refused).
 */
export function validateWebTarget(input: string, options: WebTargetOptions = {}): WebTarget {
  const defaultProtocol = options.defaultProtocol ?? 'https';
  const allowHttp = options.allowHttp ?? true;

  if (typeof input !== 'string') {
    throw new ValidationError('Target must be text');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new ValidationError('Enter a hostname or URL');
  }
  if (trimmed.length > MAX_INPUT_LENGTH) {
    throw new ValidationError(`Target exceeds ${MAX_INPUT_LENGTH} characters`);
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new ValidationError('Target contains control characters');
  }
  if (/\s/.test(trimmed)) {
    throw new ValidationError('Target must not contain whitespace');
  }

  let protocol: WebProtocol = defaultProtocol;
  let authority: string;
  let path = '/';
  let explicitScheme = false;

  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw new BlockedTargetError(
        `Only http:// and https:// targets are supported (received "${scheme}://").`
      );
    }
    protocol = scheme;
    explicitScheme = true;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new ValidationError('That URL could not be parsed');
    }
    if (parsed.username || parsed.password) {
      throw new BlockedTargetError('Targets containing embedded credentials are not supported');
    }
    authority = parsed.host;
    path = normalizePath(`${parsed.pathname}${parsed.search}`);
  } else if (trimmed.startsWith('//')) {
    const slash = trimmed.indexOf('/', 2);
    authority = slash === -1 ? trimmed.slice(2) : trimmed.slice(2, slash);
    path = normalizePath(slash === -1 ? '/' : trimmed.slice(slash));
  } else {
    const slash = trimmed.indexOf('/');
    authority = slash === -1 ? trimmed : trimmed.slice(0, slash);
    path = normalizePath(slash === -1 ? '/' : trimmed.slice(slash));
  }

  if (!authority) {
    throw new ValidationError('Enter a hostname or URL');
  }

  const { host, port } = splitHostPort(authority);
  if (!host) {
    throw new ValidationError('Target host is required');
  }

  const defaultPort = protocol === 'https' ? 443 : 80;
  const resolvedPort = resolvePort(port, defaultPort);

  if (protocol === 'http' && !allowHttp) {
    throw new BlockedTargetError('This tool only inspects HTTPS targets');
  }

  const { hostname, isIPLiteral } = assertSafeHostname(host);
  const headerHost = isIPLiteral && hostname.includes(':') ? `[${hostname}]` : hostname;

  return {
    input: trimmed,
    hostname,
    port: resolvedPort,
    protocol,
    hostHeader: resolvedPort === defaultPort ? headerHost : `${headerHost}:${resolvedPort}`,
    identityHost: hostname,
    isIPLiteral,
    explicitScheme,
    path,
  };
}

/** Builds the absolute URL a validated target describes. */
export function targetToUrl(target: WebTarget): URL {
  const hostLiteral =
    target.isIPLiteral && target.hostname.includes(':') ? `[${target.hostname}]` : target.hostname;
  const defaultPort = target.protocol === 'https' ? 443 : 80;
  const portSuffix = target.port === defaultPort ? '' : `:${target.port}`;
  return new URL(`${target.protocol}://${hostLiteral}${portSuffix}${target.path}`);
}

/**
 * Re-validates a URL that came from a redirect or from a third party (RDAP)
 * before it is fetched.
 */
export function validateServiceUrl(rawUrl: string, options: { httpsOnly?: boolean } = {}): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError('Target URL could not be parsed');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BlockedTargetError('Only http and https URLs can be fetched');
  }
  if (options.httpsOnly && parsed.protocol !== 'https:') {
    throw new BlockedTargetError('Only HTTPS URLs can be fetched by this service');
  }
  if (parsed.username || parsed.password) {
    throw new BlockedTargetError('URLs containing embedded credentials are not supported');
  }
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  if (port !== 80 && port !== 443) {
    throw new BlockedTargetError('Only ports 80 and 443 can be fetched');
  }

  assertSafeHostname(parsed.hostname);
  return parsed;
}