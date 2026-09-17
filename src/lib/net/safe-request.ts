import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
} from 'http';
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from 'https';
import { checkServerIdentity, type PeerCertificate } from 'tls';
import { gunzipSync, inflateSync } from 'zlib';
import { config } from '@/lib/config';
import { AppError, AppErrorCode, TargetUnreachableError } from '@/lib/errors/app-error';
import { resolvePublicAddresses, type PublicAddress } from '@/lib/net/address-resolver';
import { isIPLiteralHostName, stripBrackets } from '@/lib/net/host';
import { validateServiceUrl } from '@/lib/net/target';

/**
 * The only outbound HTTP client used by Ravelyth's web diagnostics.
 *
 * Safety properties, in order of importance:
 *  1. Every hostname is resolved first and every answer must be a public
 *     unicast address (see address-resolver). Otherwise the request fails.
 *  2. The connection is made to the validated IP address directly, so no
 *     second DNS lookup happens between validation and connect. That removes
 *     the DNS-rebinding window.
 *  3. Only the http/https schemes and ports 80/443 are permitted, both on the
 *     original request and on every redirect hop.
 *  4. Redirects are re-validated (no scheme downgrade, no non-web port, no
 *     private destination) and the total number of hops is capped.
 *  5. Timeouts are one budget for the whole call, and bodies are read only up
 *     to an explicit byte limit; head-only checks read no body at all.
 *  6. Returned content is never executed or interpreted as anything but text.
 */

export const DIAGNOSTIC_USER_AGENT = 'Ravelyth-Diagnostics/1.0 (+https://ravelyth.in)';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface SafeHttpResponse {
  requestedUrl: string;
  finalUrl: string;
  protocol: 'http' | 'https';
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  /** Lowercased header name -> joined values. */
  headers: Record<string, string>;
  /** Ordered header list as received (repeated headers are repeated). */
  headerList: HeaderEntry[];
  redirects: Array<{
    from: string;
    to: string;
    statusCode: number;
    followed: boolean;
    reason?: string;
  }>;
  redirectStopReason?: string;
  remoteAddress: string;
  timingMs: number;
  bodyBytes: number;
  body: string | null;
  bodyTruncated: boolean;
}

export interface SafeAttemptInfo {
  address: string;
  family: 4 | 6;
  protocol: 'http' | 'https';
  url: string;
  ok: boolean;
  statusCode: number | null;
  timingMs: number;
  error: string | null;
}

export interface SafeRequestOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  /** Total budget for the whole call, redirects included. */
  timeoutMs?: number;
  maxRedirects?: number;
  /** 0 requests only the response head; no body is read. */
  maxBytes?: number;
  httpsOnly?: boolean;
  /**
   * Reports every real connection attempt (address by address) so callers can
   * show exactly what was tried. No additional requests are made for this.
   */
  onAttempt?: (info: SafeAttemptInfo) => void;
}

interface RawResponse {
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
  truncated: boolean;
  remoteAddress: string;
  elapsedMs: number;
}

interface SingleRequestOptions {
  method: 'GET' | 'HEAD';
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
  /** Host name used for TLS identity verification and SNI. */
  identityHost: string;
}

const TLS_MESSAGES: Record<string, string> = {
  CERT_HAS_EXPIRED: 'The server presented a TLS certificate that has expired.',
  CERT_NOT_YET_VALID: 'The server presented a TLS certificate that is not valid yet.',
  ERR_TLS_CERT_ALTNAME_INVALID:
    'The TLS certificate does not cover the requested hostname (identity check failed).',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'The server presented a self-signed certificate.',
  SELF_SIGNED_CERT_IN_CHAIN: 'The certificate chain contains a self-signed certificate.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    'The certificate could not be verified using the system trust store.',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:
    'The certificate issuer could not be found in the system trust store.',
  UNABLE_TO_GET_ISSUER_CERT: 'The certificate chain is incomplete.',
};

/** Maps transport errors onto Ravelyth's API error contract. */
function mapNetworkError(error: NodeJS.ErrnoException, context: string): AppError {
  if (error instanceof AppError) return error;
  const code = error.code ?? '';

  if (TLS_MESSAGES[code] || code.startsWith('ERR_TLS') || code.startsWith('ERR_SSL')) {
    return new AppError(
      AppErrorCode.TLS_ERROR,
      TLS_MESSAGES[code] ?? `The TLS handshake with ${context} failed.`,
      502,
      { tlsCode: code }
    );
  }

  switch (code) {
    case 'ETIMEOUT':
    case 'ETIMEDOUT':
      return new AppError(AppErrorCode.HTTP_TIMEOUT, `No response from ${context} in time.`, 504);
    case 'ECONNREFUSED':
      return new TargetUnreachableError(`${context} refused the connection.`, { code });
    case 'ECONNRESET':
    case 'EPIPE':
      return new TargetUnreachableError(`The connection to ${context} was reset.`, { code });
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return new TargetUnreachableError(`${context} is unreachable from Ravelyth.`, { code });
    default:
      return new TargetUnreachableError(`The connection to ${context} failed.`, {
        code: code || 'UNKNOWN',
      });
  }
}

/** Only transport-level failures justify trying another resolved address. */
function isRetryableAcrossAddresses(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  return error.code === AppErrorCode.TARGET_UNREACHABLE;
}

function decodeBody(buffer: Buffer, contentEncoding: string | undefined): string {
  const encoding = (contentEncoding ?? '').toLowerCase();
  try {
    if (encoding.includes('gzip')) return gunzipSync(buffer).toString('utf8');
    if (encoding.includes('deflate')) return inflateSync(buffer).toString('utf8');
  } catch {
    // Fall through: report the raw bytes as text rather than failing.
  }
  return buffer.toString('utf8');
}

function normalizeHeaders(headers: IncomingHttpHeaders): {
  map: Record<string, string>;
  list: HeaderEntry[];
} {
  const map: Record<string, string> = {};
  const list: HeaderEntry[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    map[name.toLowerCase()] = values.join(', ');
    for (const item of values) {
      list.push({ name: name.toLowerCase(), value: item });
    }
  }
  return { map, list };
}

function performSingleRequest(
  url: URL,
  address: PublicAddress,
  options: SingleRequestOptions
): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const defaultPort = isHttps ? 443 : 80;
    const port = Number(url.port || defaultPort);
    const hostLiteral = url.hostname;
    const context = url.hostname;
    const startedAt = Date.now();

    const requestOptions: HttpsRequestOptions = {
      // Connecting to the validated address (not the name) is what makes the
      // safety check and the connection describe the same peer.
      host: address.address,
      port,
      path: `${url.pathname}${url.search}`,
      method: options.method,
      headers: {
        Host: port === defaultPort ? hostLiteral : `${hostLiteral}:${port}`,
        'User-Agent': DIAGNOSTIC_USER_AGENT,
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'close',
        ...options.headers,
      },
      agent: false,
      setHost: false,
      timeout: options.timeoutMs,
    };

    if (isHttps) {
      const identity = options.identityHost;
      requestOptions.servername = isIPLiteralHostName(identity) ? undefined : identity;
      requestOptions.rejectUnauthorized = true;
      requestOptions.minVersion = 'TLSv1.2';
      requestOptions.checkServerIdentity = (_host: string, cert: PeerCertificate) =>
        checkServerIdentity(identity, cert);
    }

    let settled = false;
    let response: IncomingMessage | null = null;

    const hardTimer = setTimeout(() => {
      settle(() =>
        reject(
          new AppError(AppErrorCode.HTTP_TIMEOUT, `No response from ${context} in time.`, 504)
        )
      );
    }, options.timeoutMs + 250);

    function cleanup(): void {
      clearTimeout(hardTimer);
      response?.destroy();
      request.destroy();
    }

    function settle(action: () => void): void {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    }

    const request = isHttps ? httpsRequest(requestOptions) : httpRequest(requestOptions);

    function build(body: Buffer, truncated: boolean): RawResponse {
      return {
        statusCode: response?.statusCode ?? 0,
        statusMessage: response?.statusMessage ?? '',
        httpVersion: response?.httpVersion ?? '1.1',
        headers: response?.headers ?? {},
        body,
        truncated,
        remoteAddress: (response?.socket?.remoteAddress as string | undefined) ?? address.address,
        elapsedMs: Date.now() - startedAt,
      };
    }

    request.on('response', (res) => {
      response = res;

      if (options.maxBytes === 0) {
        settle(() => resolve(build(Buffer.alloc(0), false)));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;

      res.on('data', (chunk: Buffer) => {
        if (settled) return;
        const remaining = options.maxBytes - bytes;
        if (remaining <= 0) {
          settle(() => resolve(build(Buffer.concat(chunks), true)));
          return;
        }
        const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        chunks.push(slice);
        bytes += slice.length;
        if (bytes >= options.maxBytes) {
          settle(() => resolve(build(Buffer.concat(chunks), true)));
        }
      });

      res.on('end', () => settle(() => resolve(build(Buffer.concat(chunks), false))));
      res.on('error', (error: Error) =>
        settle(() => reject(mapNetworkError(error as NodeJS.ErrnoException, context)))
      );
    });

    request.on('timeout', () =>
      settle(() =>
        reject(new AppError(AppErrorCode.HTTP_TIMEOUT, `No response from ${context} in time.`, 504))
      )
    );

    request.on('error', (error: Error) =>
      settle(() => reject(mapNetworkError(error as NodeJS.ErrnoException, context)))
    );

    request.end();
  });
}

function toResponse(
  url: URL,
  raw: RawResponse,
  headerMap: Record<string, string>,
  headerList: HeaderEntry[],
  redirects: SafeHttpResponse['redirects'],
  redirectStopReason: string | undefined,
  requestedUrl: string
): SafeHttpResponse {
  const body = raw.body.length > 0 ? decodeBody(raw.body, headerMap['content-encoding']) : null;
  return {
    requestedUrl,
    finalUrl: url.href,
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    statusCode: raw.statusCode,
    statusMessage: raw.statusMessage,
    httpVersion: raw.httpVersion,
    headers: headerMap,
    headerList,
    redirects,
    ...(redirectStopReason ? { redirectStopReason } : {}),
    remoteAddress: raw.remoteAddress,
    timingMs: raw.elapsedMs,
    bodyBytes: raw.body.length,
    body,
    bodyTruncated: raw.truncated,
  };
}

/**
 * Performs one SSRF-safe HTTP request, following a bounded number of
 * redirects. The initial URL is re-validated, and so is every redirect
 * destination, before any connection is attempted.
 */
export async function safeRequest(
  rawUrl: string | URL,
  options: SafeRequestOptions = {}
): Promise<SafeHttpResponse> {
  const timeoutMs = options.timeoutMs ?? config.HTTP_REQUEST_TIMEOUT_MS;
  const maxRedirects = Math.max(0, options.maxRedirects ?? config.HTTP_MAX_REDIRECTS);
  const maxBytes = options.maxBytes ?? 0;
  const method = options.method ?? 'GET';
  const requestedUrl = typeof rawUrl === 'string' ? rawUrl : rawUrl.href;
  const deadline = Date.now() + timeoutMs;
  const redirects: SafeHttpResponse['redirects'] = [];

  let current = validateServiceUrl(requestedUrl, { httpsOnly: options.httpsOnly });

  for (;;) {
    if (deadline - Date.now() <= 0) {
      throw new AppError(AppErrorCode.HTTP_TIMEOUT, `No response within ${timeoutMs} ms.`, 504);
    }

    const addresses = await resolvePublicAddresses(stripBrackets(current.hostname));
    let raw: RawResponse | null = null;
    let lastError: unknown = null;

    for (const address of addresses) {
      const attemptBudget = deadline - Date.now();
      if (attemptBudget <= 0) break;
      try {
        raw = await performSingleRequest(current, address, {
          method,
          headers: options.headers ?? {},
          timeoutMs: attemptBudget,
          maxBytes,
          identityHost: stripBrackets(current.hostname),
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isRetryableAcrossAddresses(error)) break;
      }
    }

    if (!raw) {
      throw lastError instanceof AppError
        ? lastError
        : new TargetUnreachableError(`Could not connect to ${current.hostname}.`);
    }

    const { map, list } = normalizeHeaders(raw.headers);
    const stop = (reason: string | undefined) =>
      toResponse(current, raw as RawResponse, map, list, redirects, reason, requestedUrl);

    if (!REDIRECT_STATUSES.has(raw.statusCode) || !map.location) {
      return stop(undefined);
    }

    let next: URL;
    try {
      next = new URL(map.location, current);
    } catch {
      return stop('The redirect Location header was not a valid URL.');
    }

    let reason: string | undefined;
    if (redirects.length >= maxRedirects) {
      reason = `Redirect limit (${maxRedirects}) reached; the last hop was not followed.`;
    } else if (next.protocol !== 'http:' && next.protocol !== 'https:') {
      reason = `Refusing to follow a redirect to the ${next.protocol} scheme.`;
    } else if (current.protocol === 'https:' && next.protocol === 'http:') {
      reason = 'Refusing to follow a redirect that downgrades HTTPS to HTTP.';
    } else {
      try {
        next = validateServiceUrl(next.href, { httpsOnly: options.httpsOnly });
      } catch (error) {
        reason =
          error instanceof AppError ? error.message : 'The redirect destination was rejected.';
      }
    }

    redirects.push({
      from: current.href,
      to: next.href,
      statusCode: raw.statusCode,
      followed: reason === undefined,
      ...(reason ? { reason } : {}),
    });

    if (reason !== undefined) {
      return stop(reason);
    }

    current = next;
  }
}