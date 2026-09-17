import { X509Certificate } from 'crypto';
import {
  checkServerIdentity,
  connect as tlsConnect,
  type DetailedPeerCertificate,
  type PeerCertificate,
} from 'tls';
import { config } from '@/lib/config';
import { AppError, AppErrorCode, TargetUnreachableError } from '@/lib/errors/app-error';
import { finding } from '@/lib/dns/analysis/findings';
import { resolvePublicAddresses } from '@/lib/net/address-resolver';
import { isIPLiteralHostName } from '@/lib/net/host';
import type { WebTarget } from '@/lib/net/target';
import type { CertificateChainEntry, CertificateDetails, Finding, SslCheckResult } from '@/types/domain';

/**
 * Low-level TLS inspection.
 *
 * What this module actually does: it opens one TLS handshake per address (no
 * HTTP request is sent, no application data is written) and reads the
 * certificate chain the server presented, together with the verification
 * verdict the Node.js TLS stack produced for that chain.
 *
 * Deliberate limit: the handshake uses `rejectUnauthorized: false` so that a
 * broken certificate can still be *reported* rather than aborting the check.
 * Chain verification is taken from `socket.authorized` /
 * `socket.authorizationError`, which the TLS stack computes regardless of that
 * flag, and hostname identity is evaluated explicitly with the same
 * `checkServerIdentity` function Node uses for ordinary connections.
 */

const MAX_CHAIN_DEPTH = 10;

function parseCertDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function daysUntil(targetIso: string, now: Date): number | null {
  const time = new Date(targetIso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((time - now.getTime()) / 86_400_000);
}

function toX509(cert: PeerCertificate | undefined): X509Certificate | null {
  const raw = cert?.raw;
  if (!raw) return null;
  try {
    return new X509Certificate(raw);
  } catch {
    return null;
  }
}

/** Extracts DNS names from an X.509 `subjectAltName` string. */
export function parseSubjectAltNames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.replace(/^(DNS|IP Address|IP):\s*/i, '').trim())
    .filter((part) => part.length > 0 && !/^(email|URI):/i.test(part));
}

/** Common-name values may repeat in malformed certificates; keep first text. */
function firstCommonName(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function describeSubject(legacy: PeerCertificate, x509: X509Certificate | null): string {
  if (x509?.subject) return x509.subject.replace(/\n/g, ', ');
  const cn = firstCommonName(legacy.subject?.CN);
  return cn ? `CN=${cn}` : 'unavailable';
}

function describeIssuer(legacy: PeerCertificate, x509: X509Certificate | null): string {
  if (x509?.issuer) return x509.issuer.replace(/\n/g, ', ');
  const cn = firstCommonName(legacy.issuer?.CN);
  return cn ? `CN=${cn}` : 'unavailable';
}

/** Human-readable wording for a Node TLS verification failure code. */
export function tlsVerificationMessage(code: string | null): string {
  switch (code) {
    case 'CERT_HAS_EXPIRED':
      return 'The certificate has expired.';
    case 'CERT_NOT_YET_VALID':
      return 'The certificate is not valid yet.';
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return 'The certificate does not cover this hostname.';
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
      return 'The certificate is self-signed and is not trusted.';
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'The certificate chain contains an untrusted self-signed certificate.';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return 'The certificate could not be verified using the trusted CA list.';
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
      return 'The certificate issuer is not present in the trusted CA list.';
    case 'UNABLE_TO_GET_ISSUER_CERT':
      return 'The server did not present a complete certificate chain.';
    case 'CERT_UNTRUSTED':
      return 'The certificate is not trusted.';
    default:
      return code
        ? `Certificate verification failed (${code}).`
        : 'Certificate verification failed.';
  }
}

export interface HandshakeResult {
  address: string;
  /** Chain-verification verdict from the Node.js TLS stack. */
  authorized: boolean;
  authorizationError: string | null;
  protocol: string | null;
  cipher: string | null;
  certificate: CertificateDetails | null;
  chain: CertificateChainEntry[];
  /** Non-null when the certificate does not cover the requested hostname. */
  identityError: string | null;
  timingMs: number;
}

function buildChain(cert: DetailedPeerCertificate): CertificateChainEntry[] {
  const entries: CertificateChainEntry[] = [];
  const seen = new Set<string>();
  let current: PeerCertificate | DetailedPeerCertificate | undefined = cert;

  while (current && entries.length < MAX_CHAIN_DEPTH) {
    const x509 = toX509(current);
    const fingerprint =
      x509?.fingerprint256 ?? current.fingerprint256 ?? `depth-${entries.length}`;
    if (seen.has(fingerprint)) break;
    seen.add(fingerprint);

    const subject = describeSubject(current, x509);
    const issuer = describeIssuer(current, x509);
    entries.push({
      depth: entries.length,
      subject,
      issuer,
      validFrom: parseCertDate(current.valid_from) ?? undefined,
      validTo: parseCertDate(current.valid_to) ?? undefined,
      isCA: x509?.ca ?? false,
      selfSigned: subject === issuer,
      fingerprintSha256: x509?.fingerprint256 ?? current.fingerprint256 ?? undefined,
    });

    // Node repeats the final certificate as its own issuer; the fingerprint
    // guard above terminates the walk in that case. `issuerCertificate` only
    // exists when the full chain was captured (the `true` argument above).
    current =
      'issuerCertificate' in current
        ? (current as DetailedPeerCertificate).issuerCertificate
        : undefined;
  }

  return entries;
}

function mapTlsTransportError(error: NodeJS.ErrnoException, hostname: string): AppError {
  const code = error.code ?? '';
  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT') {
    return new AppError(
      AppErrorCode.HTTP_TIMEOUT,
      `The TLS handshake with ${hostname} did not complete in time.`,
      504
    );
  }
  if (code.startsWith('ERR_SSL') || code.startsWith('ERR_TLS') || code.startsWith('EPROTO')) {
    return new AppError(
      AppErrorCode.TLS_ERROR,
      `The server could not complete a TLS handshake (${code}).`,
      502,
      { tlsCode: code }
    );
  }
  return new TargetUnreachableError(`Could not establish a TLS connection to ${hostname}.`, {
    code: code || 'UNKNOWN',
  });
}

/**
 * Performs one TLS handshake against an address that has already passed the
 * public-address filter, and reports what the server presented.
 */
export function runHandshake(
  address: string,
  hostname: string,
  timeoutMs: number
): Promise<HandshakeResult> {
  return new Promise<HandshakeResult>((resolve, reject) => {
    const startedAt = Date.now();
    const socket = tlsConnect({
      host: address,
      port: 443,
      servername: isIPLiteralHostName(hostname) ? undefined : hostname,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    });

    let settled = false;
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new AppError(
              AppErrorCode.HTTP_TIMEOUT,
              `The TLS handshake with ${hostname} did not complete in time.`,
              504
            )
          )
        ),
      timeoutMs
    );

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Closed without writing a single byte of application data.
      socket.destroy();
      action();
    }

    socket.once('secureConnect', () => {
      try {
        const legacy = socket.getPeerCertificate(true);
        const x509 = socket.getPeerX509Certificate() ?? toX509(legacy);
        const altNames = x509?.subjectAltName
          ? parseSubjectAltNames(x509.subjectAltName)
          : parseSubjectAltNames(legacy.subjectaltname);
        const validFrom = parseCertDate(x509?.validFrom ?? legacy.valid_from);
        const validTo = parseCertDate(x509?.validTo ?? legacy.valid_to);
        const now = new Date();
        const identityError = checkServerIdentity(hostname, legacy);
        const cipher = socket.getCipher();

        finish(() =>
          resolve({
            address,
            authorized: socket.authorized === true,
            authorizationError:
              socket.authorized === true
                ? null
                : (socket.authorizationError?.toString() ?? 'UNKNOWN'),
            protocol: socket.getProtocol(),
            cipher: cipher?.name ?? null,
            certificate: {
              subject: describeSubject(legacy, x509),
              commonName: firstCommonName(legacy.subject?.CN),
              issuer: describeIssuer(legacy, x509),
              issuerCommonName: firstCommonName(legacy.issuer?.CN),
              altNames,
              validFrom: validFrom ?? undefined,
              validTo: validTo ?? undefined,
              daysRemaining: validTo ? daysUntil(validTo, now) : null,
              serialNumber: x509?.serialNumber ?? legacy.serialNumber,
              fingerprintSha256: x509?.fingerprint256 ?? legacy.fingerprint256,
              isCA: x509?.ca ?? false,
              selfSigned: (() => {
                const subjectCn = firstCommonName(legacy.subject?.CN);
                const issuerCn = firstCommonName(legacy.issuer?.CN);
                return (
                  typeof subjectCn === 'string' && subjectCn !== '' && subjectCn === issuerCn
                );
              })(),
            },
            chain: buildChain(legacy as DetailedPeerCertificate),
            identityError: identityError ? identityError.message : null,
            timingMs: Date.now() - startedAt,
          })
        );
      } catch {
        finish(() =>
          reject(
            new AppError(
              AppErrorCode.TLS_ERROR,
              `The certificate presented by ${hostname} could not be read.`,
              502
            )
          )
        );
      }
    });

    socket.once('error', (error: Error) =>
      finish(() => reject(mapTlsTransportError(error as NodeJS.ErrnoException, hostname)))
    );
  });
}

export interface CertificateFindingInput {
  hostname: string;
  chainTrusted: boolean;
  verificationError: string | null;
  hostnameCovered: boolean;
  identityError: string | null;
  certificate: CertificateDetails | null;
  protocol: string | null;
  cipher: string | null;
}

/** Findings describe only what the handshake above actually reported. */
export function buildCertificateFindings(input: CertificateFindingInput): Finding[] {
  const findings: Finding[] = [];
  const expiryDays = input.certificate?.daysRemaining ?? null;

  findings.push(
    input.chainTrusted
      ? finding(
          'SSL_CHAIN_TRUSTED',
          'pass',
          'tls',
          'Certificate chain verified',
          'The presented chain validates against the trust store used by this server.',
          `Node.js TLS evaluated the chain for ${input.hostname} against the system trust store.`
        )
      : finding(
          'SSL_CHAIN_UNTRUSTED',
          'error',
          'tls',
          'Certificate chain did not verify',
          tlsVerificationMessage(input.verificationError),
          'Browsers will warn or refuse the connection until the chain is fixed.',
          { recommendation: 'Install the complete chain for this hostname, including intermediate certificates.' }
        )
  );

  findings.push(
    input.hostnameCovered
      ? finding(
          'SSL_HOSTNAME_MATCH',
          'pass',
          'tls',
          'Certificate covers the requested hostname',
          `${input.hostname} matches the certificate's subject alternative names or common name.`,
          'Identity was checked with the same hostname-matching function Node.js uses for normal connections.'
        )
      : finding(
          'SSL_HOSTNAME_MISMATCH',
          'error',
          'tls',
          'Certificate does not cover the requested hostname',
          input.identityError ?? 'The certificate is not valid for this hostname.',
          'Clients connecting to this name will report a name-mismatch error.',
          { recommendation: 'Issue or install a certificate that lists this hostname in its subject alternative names.' }
        )
  );

  if (expiryDays !== null) {
    if (expiryDays < 0) {
      findings.push(
        finding(
          'SSL_EXPIRED',
          'error',
          'tls',
          'Certificate has expired',
          `The expiry date passed ${Math.abs(expiryDays)} day(s) ago.`,
          'Expired certificates are rejected by browsers and most clients.',
          { recommendation: 'Renew the certificate and reload it on the server.' }
        )
      );
    } else if (expiryDays <= 7) {
      findings.push(
        finding(
          'SSL_EXPIRING_CRITICAL',
          'error',
          'tls',
          'Certificate expires within a week',
          `The certificate expires in ${expiryDays} day(s).`,
          'Automatic renewal may be failing; expiry is imminent.',
          { recommendation: 'Verify renewal automation is healthy and renew now.' }
        )
      );
    } else if (expiryDays <= 30) {
      findings.push(
        finding(
          'SSL_EXPIRING_SOON',
          'warning',
          'tls',
          'Certificate expires soon',
          `The certificate expires in ${expiryDays} day(s).`,
          'There is still time, but renewal should be confirmed before the expiry date.',
          { recommendation: 'Confirm the certificate renews automatically well before expiry.' }
        )
      );
    } else {
      findings.push(
        finding(
          'SSL_EXPIRY_OK',
          'pass',
          'tls',
          'Certificate validity window is comfortable',
          `The certificate expires in ${expiryDays} day(s).`,
          'No immediate action is required based on the expiry date alone.'
        )
      );
    }
  }

  if (input.certificate?.selfSigned) {
    findings.push(
      finding(
        'SSL_SELF_SIGNED',
        'warning',
        'tls',
        'Certificate appears self-signed',
        'The subject and issuer names are identical, which is typical of self-signed certificates.',
        'Self-signed certificates are not trusted by public clients unless installed manually.',
        { recommendation: 'Use a certificate from a publicly trusted certificate authority for public services.' }
      )
    );
  }

  if ((input.certificate?.altNames.length ?? 0) === 0) {
    findings.push(
      finding(
        'SSL_NO_SAN',
        'warning',
        'tls',
        'No subject alternative names observed',
        'The certificate did not expose any subject alternative names.',
        'Modern clients ignore the legacy common name field and require SAN entries.',
        { recommendation: 'Reissue the certificate with the hostnames listed as SAN entries.' }
      )
    );
  }

  findings.push(
    finding(
      'SSL_PROTOCOL_OBSERVED',
      'info',
      'tls',
      'Negotiated TLS version and cipher',
      `${input.protocol ?? 'unknown'} with ${input.cipher ?? 'unknown cipher'}.`,
      'Only the version and cipher negotiated with Ravelyth are reported. Other clients may negotiate differently, and TLS 1.0/1.1 support is not probed.'
    )
  );

  return findings;
}

/**
 * Inspects the TLS certificate presented for a validated web target.
 * Tries each allowed (public) address until a handshake completes.
 */
export async function inspectCertificate(target: WebTarget): Promise<SslCheckResult> {
  const addresses = await resolvePublicAddresses(target.hostname);
  const timeoutMs = config.TLS_CONNECT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let handshakeResult: HandshakeResult | null = null;
  let lastError: unknown = null;

  for (const address of addresses) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      handshakeResult = await runHandshake(address.address, target.hostname, remaining);
      break;
    } catch (error) {
      lastError = error;
      // TLS protocol or verification problems repeat identically on every
      // address of the same host, so only transport failures are retried.
      if (error instanceof AppError && error.code !== AppErrorCode.TARGET_UNREACHABLE) break;
    }
  }

  if (!handshakeResult) {
    throw lastError instanceof AppError
      ? lastError
      : new TargetUnreachableError(`Could not establish a TLS connection to ${target.hostname}.`);
  }

  const now = new Date();
  const certificate = handshakeResult.certificate;
  const hostnameCovered = handshakeResult.identityError === null;
  const chainTrusted = handshakeResult.authorized;

  const findings = buildCertificateFindings({
    hostname: target.hostname,
    chainTrusted,
    verificationError: handshakeResult.authorizationError,
    hostnameCovered,
    identityError: handshakeResult.identityError,
    certificate,
    protocol: handshakeResult.protocol,
    cipher: handshakeResult.cipher,
  });

  return {
    hostname: target.hostname,
    port: target.port,
    inspectedAt: now.toISOString(),
    connectedAddress: handshakeResult.address,
    handshakeTimeMs: handshakeResult.timingMs,
    chainTrusted,
    verificationError: handshakeResult.authorizationError,
    hostnameCovered,
    protocol: handshakeResult.protocol,
    cipher: handshakeResult.cipher,
    certificate,
    chain: handshakeResult.chain,
    findings,
  };
}