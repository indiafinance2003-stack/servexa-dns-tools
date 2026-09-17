import { safeRequest, type SafeHttpResponse } from '@/lib/net/safe-request';
import { config } from '@/lib/config';
import { buildBodyPreview, parseWebInput } from '@/lib/web/input';
import type {
  Finding,
  HttpHeaderCheckResult,
  HttpHeaderEntry,
  HttpRedirectHop,
  WebsiteAvailabilityResult,
} from '@/types/domain';

/** Header-inspection and availability services built on the SSRF-safe client. */

function toHeaderEntries(response: SafeHttpResponse): HttpHeaderEntry[] {
  return response.headerList.map((entry) => ({ name: entry.name, value: entry.value }));
}

function toHops(response: SafeHttpResponse): HttpRedirectHop[] {
  return response.redirects.map((hop) => ({
    from: hop.from,
    to: hop.to,
    statusCode: hop.statusCode,
    followed: hop.followed,
    ...(hop.reason ? { reason: hop.reason } : {}),
  }));
}

/**
 * Fetches a small bounded portion of the response and reports every header
 * exactly as received. The body is only read to produce a short text preview;
 * it is never parsed or executed.
 */
export async function inspectHttpHeaders(rawUrl: string): Promise<HttpHeaderCheckResult> {
  const url = parseWebInput(rawUrl);
  const response = await safeRequest(url, {
    method: 'GET',
    maxBytes: 4096,
    timeoutMs: config.HTTP_REQUEST_TIMEOUT_MS,
  });

  return {
    requestedUrl: response.requestedUrl,
    finalUrl: response.finalUrl,
    protocol: response.protocol,
    statusCode: response.statusCode,
    statusMessage: response.statusMessage,
    httpVersion: response.httpVersion,
    headers: toHeaderEntries(response),
    redirects: toHops(response),
    ...(response.redirectStopReason ? { redirectStopReason: response.redirectStopReason } : {}),
    remoteAddress: response.remoteAddress,
    timingMs: response.timingMs,
    bodyBytes: response.bodyBytes,
    bodyTruncated: response.bodyTruncated,
    bodyPreview: buildBodyPreview(response.body),
    notes: [
      'Headers are shown exactly as received. The body is only read to produce a short preview; it is never parsed or executed.',
      'Every redirect destination was validated (scheme, port, and public address) before being followed.',
    ],
  };
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2, pass: 3 } as const;

function availabilityFindings(
  result: Omit<WebsiteAvailabilityResult, 'findings' | 'notes'>,
  serverHeader: string | null
): Finding[] {
  const findings: Finding[] = [];

  if (!result.reachable || result.statusCode === null) {
    findings.push({
      code: 'SITE_UNREACHABLE',
      severity: 'error',
      category: 'availability',
      title: 'The site did not answer',
      summary: 'No HTTP response was received in time.',
      explanation:
        'The connection could not be established or timed out. The site may be down, the address may be wrong, or the server may not accept requests from this network.',
      recommendation:
        'Verify the address and retry. If it stays unreachable, the site is likely offline or rejects this network.',
    });
    return findings;
  }

  const ok = result.statusCode >= 200 && result.statusCode < 400;
  findings.push({
    code: 'HTTP_STATUS',
    severity: ok ? 'pass' : 'warning',
    category: 'availability',
    title: `HTTP ${result.statusCode}`,
    summary: result.statusMessage || '',
    explanation: ok
      ? 'The server answered with a successful or redirect status code.'
      : 'The server answered with an error status code, which usually indicates a problem with the page or the server.',
  });

  if (result.httpToHttpsRedirectObserved) {
    findings.push({
      code: 'HTTP_TO_HTTPS_REDIRECT',
      severity: 'pass',
      category: 'availability',
      title: 'HTTP traffic redirects to HTTPS',
      summary: 'Plain-HTTP requests were redirected to the HTTPS version of the site.',
      explanation: 'Redirecting HTTP to HTTPS keeps visitors on an encrypted connection.',
    });
  }

  if (result.redirects.length > 0) {
    findings.push({
      code: 'REDIRECT_CHAIN',
      severity: result.redirects.every((hop) => hop.followed) ? 'info' : 'warning',
      category: 'availability',
      title: `${result.redirects.length} redirect hop(s) observed`,
      summary: result.redirectStopReason ?? 'All redirects were followed.',
      explanation:
        'Redirect chains add latency. Each hop was re-validated for safety before it was followed.',
    });
  }

  if (serverHeader) {
    findings.push({
      code: 'SERVER_HEADER_EXPOSED',
      severity: 'info',
      category: 'availability',
      title: 'Server header is present',
      summary: serverHeader,
      explanation:
        'The Server header advertises server software. Some operators remove it to reduce information disclosure; its presence is not a vulnerability by itself.',
    });
  }

  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Availability check: one GET with a tiny body cap. Reports reachability,
 * timing, and the final URL only after every hop has been safety-validated.
 */
export async function checkWebsiteAvailability(rawUrl: string): Promise<WebsiteAvailabilityResult> {
  const url = parseWebInput(rawUrl);
  const startedAt = Date.now();
  const response = await safeRequest(url, {
    method: 'GET',
    maxBytes: 4096,
    timeoutMs: config.HTTP_REQUEST_TIMEOUT_MS,
  });

  const totalMs = Date.now() - startedAt;
  const statusCode = response.statusCode;
  const serverHeader = response.headers['server'] ?? null;

  const base: Omit<WebsiteAvailabilityResult, 'findings' | 'notes'> = {
    requestedUrl: response.requestedUrl,
    finalUrl: response.finalUrl,
    reachable: statusCode >= 200 && statusCode < 600 && statusCode !== 0,
    statusCode: statusCode > 0 ? statusCode : null,
    statusMessage: response.statusMessage || null,
    protocol: response.protocol,
    httpVersion: response.httpVersion || null,
    totalTimeMs: totalMs,
    redirects: toHops(response),
    ...(response.redirectStopReason ? { redirectStopReason: response.redirectStopReason } : {}),
    serverHeader,
    contentType: response.headers['content-type'] ?? null,
    contentLength: response.headers['content-length'] ?? null,
    httpToHttpsRedirectObserved: response.redirects.some(
      (hop) => hop.followed && hop.from.startsWith('http://') && hop.to.startsWith('https://')
    ),
  };

  const notes = [
    'Timing measures the full request as seen from Ravelyth, including redirects and the small body portion read. It is not a browser page-load time.',
    'Only a small portion of the response body is read; nothing returned by the site is executed.',
  ];

  return { ...base, findings: availabilityFindings(base, serverHeader), notes };
}
