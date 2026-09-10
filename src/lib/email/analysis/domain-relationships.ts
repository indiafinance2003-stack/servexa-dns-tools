import { DomainRelationship } from '@/types/domain';
import { ParsedEmail } from '@/types/domain';

const EMAIL_LIKE = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi;

export function extractDomainsFromText(value?: string): string[] {
  if (!value) return [];
  const domains = new Set<string>();
  for (const match of value.matchAll(EMAIL_LIKE)) {
    domains.add(match[1].toLowerCase().replace(/\.+$/, ''));
  }
  const host = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi;
  if (!value.includes('@')) {
    for (const match of value.matchAll(host)) {
      const candidate = match[1].toLowerCase();
      if (candidate.includes('.')) domains.add(candidate);
    }
  }
  return [...domains];
}

function firstDomain(value?: string): string | undefined {
  return extractDomainsFromText(value)[0];
}

function registrableGuess(domain?: string): string | undefined {
  if (!domain) return undefined;
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  return parts.slice(-2).join('.');
}

export function analyzeDomainRelationships(parsed: ParsedEmail): DomainRelationship[] {
  const from = firstDomain(parsed.from);
  const returnPath = firstDomain(parsed.returnPath);
  const replyTo = firstDomain(parsed.replyTo);
  const messageId = firstDomain(parsed.messageId);
  const dkimDomains = parsed.dkimSignatures
    .map((sig) => sig.signingDomain?.toLowerCase())
    .filter((value): value is string => Boolean(value));
  const authDomains = parsed.authenticationResults
    .flatMap((item) => Object.values(item.properties))
    .flatMap((value) => extractDomainsFromText(value));
  const receivedDomains = parsed.receivedHops.flatMap((hop) => hop.hostnames.map((h) => h.toLowerCase()));

  const relationships: DomainRelationship[] = [];

  const add = (
    label: string,
    domains: Array<string | undefined>,
    note: string,
    mismatch: boolean
  ) => {
    relationships.push({
      label,
      domains: domains.filter((value): value is string => Boolean(value)),
      note,
      severity: mismatch ? 'warning' : 'info',
    });
  };

  if (from && returnPath && registrableGuess(from) !== registrableGuess(returnPath)) {
    add('From vs Return-Path', [from, returnPath], 'From and Return-Path use different registrable domains. This is common with mailing lists and forwarding, and is not by itself evidence of abuse.', true);
  } else if (from && returnPath) {
    add('From vs Return-Path', [from, returnPath], 'From and Return-Path share the same apparent organizational domain.', false);
  }

  if (from && replyTo && registrableGuess(from) !== registrableGuess(replyTo)) {
    add('From vs Reply-To', [from, replyTo], 'Reply-To differs from From. This can be legitimate (ticketing, lists) or a social-engineering pattern. No reputation lookup was performed.', true);
  }

  for (const dkim of dkimDomains) {
    if (from && registrableGuess(from) !== registrableGuess(dkim)) {
      add('From vs DKIM d=', [from, dkim], 'The DKIM signing domain differs from the From domain. DMARC alignment may fail depending on alignment mode. Cryptographic verification not performed.', true);
    } else if (from) {
      add('From vs DKIM d=', [from, dkim], 'DKIM signing domain matches the From organizational domain at a heuristic level. Cryptographic verification not performed.', false);
    }
  }

  if (from && messageId && registrableGuess(from) !== registrableGuess(messageId)) {
    add('From vs Message-ID', [from, messageId], 'Message-ID domain differs from From. This is often benign.', false);
  }

  if (authDomains.length > 0) {
    add('Authentication-Results related domains', [...new Set(authDomains)], 'Domains extracted from Authentication-Results properties as reported by a receiving server.', false);
  }

  if (receivedDomains.length > 0) {
    add('Received hostnames', [...new Set(receivedDomains)].slice(0, 12), 'Hostnames extracted from Received hops. These are not independently verified.', false);
  }

  return relationships;
}
