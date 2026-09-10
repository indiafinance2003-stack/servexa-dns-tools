import { EmailAnalysis } from '@/types/domain';
import { parseEmailHeaders } from '@/lib/email/parser/email-parser';
import { analyzeDomainRelationships } from '@/lib/email/analysis/domain-relationships';
import { finding } from '@/lib/dns/analysis/findings';
import { classifyIP, parseIP } from '@/lib/net/ip';

export function analyzeEmailHeaders(rawHeaders: string): EmailAnalysis {
  const parsed = parseEmailHeaders(rawHeaders);
  const observations = [];

  observations.push(
    finding(
      'EMAIL_SCOPE',
      'info',
      'email',
      'Header analysis is not independent authentication',
      'This report inspects headers supplied by the user.',
      'Authentication-Results and Received-SPF are claims from a receiving server. This tool does not re-run SPF, DKIM, or DMARC against the message, and cryptographic verification not performed.'
    )
  );

  if (parsed.authenticationResults.length > 0) {
    observations.push(
      finding(
        'AUTH_RESULTS_PRESENT',
        'info',
        'email',
        'Authentication-Results header present',
        `${parsed.authenticationResults.length} method result(s) were parsed.`,
        'These outcomes are reported by the authserv-id in the header. They are not independently reproduced here.'
      )
    );
  }

  if (parsed.dkimSignatures.length > 0) {
    observations.push(
      finding(
        'DKIM_SIGNATURE_PRESENT',
        'info',
        'email',
        'DKIM-Signature header present',
        `${parsed.dkimSignatures.length} signature header(s) found.`,
        'Signature present; cryptographic verification not performed.'
      )
    );
  }

  const unparseable = parsed.receivedHops.filter((hop) => !hop.parseable);
  if (unparseable.length > 0) {
    observations.push(
      finding(
        'RECEIVED_UNPARSEABLE',
        'warning',
        'email',
        'Some Received hops were not fully parsed',
        `${unparseable.length} hop(s) lacked recognizable from/by/timestamp fields.`,
        'Unusual Received syntax is common and is not evidence of malice.'
      )
    );
  }

  const internal = parsed.receivedHops.flatMap((hop) => hop.internalIps);
  if (internal.length > 0) {
    observations.push(
      finding(
        'RECEIVED_INTERNAL_IP',
        'info',
        'email',
        'Private or non-public IPs in Received chain',
        [...new Set(internal)].join(', '),
        'Internal addresses often appear on hops inside a provider network. They are not classified as malicious.'
      )
    );
  }

  const timestamps = parsed.receivedHops
    .map((hop) => (hop.timestamp ? Date.parse(hop.timestamp) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (timestamps.length >= 2) {
    const newestFirst = [...timestamps];
    let disorder = false;
    for (let i = 1; i < newestFirst.length; i += 1) {
      if (newestFirst[i] > newestFirst[i - 1] + 5 * 60 * 1000) disorder = true;
    }
    if (disorder) {
      observations.push(
        finding(
          'RECEIVED_TIME_ORDER',
          'info',
          'email',
          'Received timestamps are not strictly decreasing',
          'Hop timestamps do not follow a simple newest-to-oldest pattern.',
          'Clock skew and incomplete timestamps are common. This is not treated as proof of tampering.'
        )
      );
    }
  }

  for (const ip of parsed.receivedHops.flatMap((hop) => hop.ipAddresses)) {
    const parsedIp = parseIP(ip);
    if (parsedIp) {
      void classifyIP(parsedIp);
    }
  }

  const domains = analyzeDomainRelationships(parsed);
  for (const rel of domains.filter((item) => item.severity === 'warning')) {
    observations.push(
      finding(
        'DOMAIN_RELATIONSHIP',
        'warning',
        'email',
        rel.label,
        rel.domains.join(' vs '),
        rel.note
      )
    );
  }

  return {
    parsed,
    summary: {
      headerCount: parsed.headers.length,
      hopCount: parsed.receivedHops.length,
      dkimSignatureCount: parsed.dkimSignatures.length,
      reportedAuthMethodCount: parsed.authenticationResults.length,
    },
    senderRecipients: {
      from: parsed.from,
      to: parsed.to,
      cc: parsed.cc,
      replyTo: parsed.replyTo,
      returnPath: parsed.returnPath,
    },
    authentication: {
      reportedByReceivingServer: parsed.authenticationResults,
      detectedEvidence: {
        dkimSignatures: parsed.dkimSignatures,
        receivedSpf: parsed.receivedSpf,
        arcHeaderCount: parsed.arcHeaders.length,
      },
      verificationPerformedByThisTool: {
        spf: 'not_performed',
        dkim: 'not_performed',
        dmarc: 'not_performed',
        note: 'Header analysis is not the same as independently authenticating the email. Signature present; cryptographic verification not performed.',
      },
    },
    receivedChain: {
      hops: [...parsed.receivedHops].reverse(),
      chronologicalNote:
        'Received headers are listed with the first header as the most recent hop. The table below shows oldest-to-newest for reading the path toward the recipient.',
    },
    domains,
    metadata: {
      subject: parsed.subject,
      date: parsed.date,
      messageId: parsed.messageId,
      contentType: parsed.contentType,
      userAgent: parsed.userAgent,
      mimeVersion: parsed.mimeVersion,
    },
    observations,
    technicalDetails: { headers: parsed.headers },
  };
}
