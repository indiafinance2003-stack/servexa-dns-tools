import { safeRequest } from '@/lib/net/safe-request';
import { parseWebInput } from '@/lib/web/input';
import { finding } from '@/lib/dns/analysis/findings';
import type {
  Finding,
  FindingSeverity,
  SecurityHeaderCheck,
  WebsiteSecurityHeadersResult,
} from '@/types/domain';

/**
 * Security-header analysis. The check runs against the FINAL response of one
 * bounded GET (a 4 KiB cap; the body is read only to complete the response,
 * never parsed). Every reported header below was actually observed or
 * actually absent — nothing is inferred or fabricated.
 */

const WATCHED = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
] as const;

const WATCHED_LABELS: Record<(typeof WATCHED)[number], string> = {
  'strict-transport-security': 'Strict-Transport-Security (HSTS)',
  'content-security-policy': 'Content-Security-Policy (CSP)',
  'x-content-type-options': 'X-Content-Type-Options',
  'x-frame-options': 'X-Frame-Options',
  'referrer-policy': 'Referrer-Policy',
  'permissions-policy': 'Permissions-Policy',
  'cross-origin-opener-policy': 'Cross-Origin-Opener-Policy',
  'cross-origin-resource-policy': 'Cross-Origin-Resource-Policy',
};

const RECOMMENDATIONS: Partial<Record<(typeof WATCHED)[number], string>> = {
  'strict-transport-security':
    'Send Strict-Transport-Security, for example "max-age=31536000; includeSubDomains", once the whole site works over HTTPS.',
  'content-security-policy':
    'Publish a Content-Security-Policy that restricts scripts and frames to what the site actually uses. Start in report-only mode to tune it safely.',
  'x-content-type-options': 'Add "X-Content-Type-Options: nosniff".',
  'x-frame-options':
    'Send "X-Frame-Options: DENY" (or CSP frame-ancestors) when the site is not meant to be framed.',
  'referrer-policy': 'Send "Referrer-Policy: strict-origin-when-cross-origin" or stricter.',
  'permissions-policy':
    'Consider a Permissions-Policy that denies browser features the site does not use.',
  'cross-origin-opener-policy': 'Consider "Cross-Origin-Opener-Policy: same-origin".',
  'cross-origin-resource-policy': 'Consider "Cross-Origin-Resource-Policy: same-origin".',
};

const EXPLANATIONS: Partial<Record<(typeof WATCHED)[number], string>> = {
  'strict-transport-security':
    'HSTS tells browsers to use HTTPS for this site and refuse plain HTTP for the declared period, protecting against downgrade attacks.',
  'content-security-policy':
    'CSP restricts which resources (scripts, styles, frames) the browser may load, reducing the impact of injected content.',
  'x-content-type-options':
    '"nosniff" stops browsers from guessing a file type that differs from the declared Content-Type.',
  'x-frame-options':
    'Framing controls limit who can embed the page, which mitigates clickjacking.',
  'referrer-policy':
    'Referrer-Policy controls how much URL information is shared when users navigate away from the site.',
  'permissions-policy':
    'Permissions-Policy denies or grants powerful browser features (camera, geolocation, and similar).',
  'cross-origin-opener-policy':
    'COOP isolates the browsing context from cross-origin popups, reducing cross-window attacks.',
  'cross-origin-resource-policy':
    'CORP restricts which origins may embed this site\'s resources.',
};

/**
 * Fetches one public URL through the SSRF-safe client and reports which
 * security headers the final response actually contained. Findings mirror the
 * per-header checks so callers can render one consistent list.
 */
export async function analyzeWebsiteSecurityHeaders(
  rawUrl: string
): Promise<WebsiteSecurityHeadersResult> {
  const url = parseWebInput(rawUrl);
  // The body is not needed; a small cap keeps the response bounded.
  const response = await safeRequest(url.href, { method: 'GET', maxBytes: 4096 });
  const map = new Map<string, string[]>();
  for (const entry of response.headerList) {
    const values = map.get(entry.name) ?? [];
    values.push(entry.value);
    map.set(entry.name, values);
  }

  const checks: SecurityHeaderCheck[] = [];
  const findings: Finding[] = [];
  let present = 0;

  for (const header of WATCHED) {
    const values = map.get(header);
    const has = values !== undefined && values.length > 0;
    const value = has ? values.join(', ') : undefined;
    const label = WATCHED_LABELS[header];
    const explanation = EXPLANATIONS[header] ?? `Presence of the ${label} header was checked.`;

    let severity: FindingSeverity;
    let summary: string;
    let recommendation: string | undefined;

    if (has) {
      present += 1;
      if (header === 'strict-transport-security' && !/max-age\s*=\s*\d+/i.test(value ?? '')) {
        severity = 'warning';
        summary = 'HSTS is present but has no usable max-age directive.';
        recommendation = RECOMMENDATIONS[header];
      } else if (header === 'x-frame-options' && !/^(deny|sameorigin)$/i.test((value ?? '').trim())) {
        severity = 'info';
        summary = 'X-Frame-Options is present with a non-standard value.';
      } else {
        severity = 'pass';
        summary = `${label} is present.`;
      }
    } else {
      severity = header === 'strict-transport-security' && response.protocol === 'http' ? 'info' : 'warning';
      summary = `${label} was not sent.`;
      recommendation = RECOMMENDATIONS[header];
    }

    checks.push({
      name: label,
      present: has,
      ...(has ? { value: value!.slice(0, 512) } : {}),
      severity,
      summary,
      explanation,
      ...(recommendation ? { recommendation } : {}),
    });

    if (severity === 'pass') {
      findings.push(
        finding(
          `SEC_HEADER_${header.toUpperCase().replace(/-/g, '_')}`,
          'pass',
          'security-headers',
          `${label} present`,
          summary,
          explanation
        )
      );
    } else if (severity === 'warning') {
      findings.push(
        finding(
          `SEC_HEADER_${header.toUpperCase().replace(/-/g, '_')}_MISSING`,
          'warning',
          'security-headers',
          `${label} missing`,
          summary,
          explanation,
          { recommendation }
        )
      );
    } else if (severity !== 'info') {
      findings.push(
        finding(
          `SEC_HEADER_${header.toUpperCase().replace(/-/g, '_')}`,
          'info',
          'security-headers',
          `${label} needs attention`,
          summary,
          explanation
        )
      );
    }
  }

  const https = response.protocol === 'https';
  if (!https) {
    findings.push(
      finding(
        'SEC_HEADERS_PLAIN_HTTP',
        'warning',
        'security-headers',
        'Response was served over plain HTTP',
        'Security headers were inspected on an http:// response. Browsers only honour HSTS on HTTPS origins.',
        'Serve the site over HTTPS before evaluating HSTS.'
      )
    );
  }

  const notes = [
    'Headers are reported exactly as the final response delivered them; nothing is inferred from the body.',
    'A missing header is an observation, not proof of a vulnerability. Each recommendation should be tested against the site’s real requirements.',
  ];
  if (response.redirectStopReason) notes.push(`Redirect chain stopped: ${response.redirectStopReason}`);

    return {
    finalUrl: response.finalUrl,
    statusCode: response.statusCode,
    https,
    checks,
    score: { present, missing: WATCHED.length - present, total: WATCHED.length },
    findings,
    notes,
  };
}

/**
 * Mapping from lowercased header names to their canonical display form.
 * Used by `@/lib/net/safe-http` for stable header-name presentation so the
 * display logic is not duplicated across the response-header and the
 * security-header tools.
 */
export const CANONICAL_HEADER_ALIASES: ReadonlyMap<string, string> = new Map(
  Object.entries({
    'content-security-policy': 'Content-Security-Policy',
    'strict-transport-security': 'Strict-Transport-Security',
    'x-content-type-options': 'X-Content-Type-Options',
    'x-frame-options': 'X-Frame-Options',
    'referrer-policy': 'Referrer-Policy',
    'permissions-policy': 'Permissions-Policy',
    'cross-origin-opener-policy': 'Cross-Origin-Opener-Policy',
    'cross-origin-resource-policy': 'Cross-Origin-Resource-Policy',
    'content-type': 'Content-Type',
    'content-length': 'Content-Length',
    'content-encoding': 'Content-Encoding',
    'content-language': 'Content-Language',
    'last-modified': 'Last-Modified',
    'etag': 'ETag',
    'cache-control': 'Cache-Control',
    'expires': 'Expires',
    'server': 'Server',
    'via': 'Via',
    'set-cookie': 'Set-Cookie',
    'www-authenticate': 'WWW-Authenticate',
    'location': 'Location',
    'allow': 'Allow',
    'accept': 'Accept',
    'accept-language': 'Accept-Language',
    'accept-encoding': 'Accept-Encoding',
  })
);