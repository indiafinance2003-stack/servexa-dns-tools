import { DKIMDnsRecord, DKIMSignature } from '@/types/domain';

export function isDkimDnsRecord(txt: string): boolean {
  const trimmed = txt.trim();
  return /(?:^|;)\s*v\s*=\s*DKIM1(?:;|$)/i.test(`;${trimmed}`) || /^v\s*=\s*DKIM1/i.test(trimmed) || /(?:^|;)\s*p\s*=/i.test(trimmed);
}

function splitTags(input: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of input.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    tags[key] = trimmed.slice(eq + 1).trim();
  }
  return tags;
}

export function parseDKIMDnsRecord(record: string): DKIMDnsRecord {
  const tags = splitTags(record);
  const errors: string[] = [];
  const version = tags.v;
  if (version && version.toUpperCase() !== 'DKIM1') {
    errors.push(`Unexpected DKIM version: ${version}`);
  }
  const publicKey = tags.p;
  const publicKeyPresent = typeof publicKey === 'string' && publicKey.replace(/\s+/g, '').length > 0;
  if (tags.p === undefined) {
    errors.push('DKIM DNS record is missing p= (public key)');
  } else if (!publicKeyPresent) {
    errors.push('DKIM public key is empty (selector may be revoked)');
  }

  return {
    record,
    version: version || 'DKIM1',
    keyType: tags.k || 'rsa',
    publicKey: publicKeyPresent ? publicKey.replace(/\s+/g, '') : publicKey,
    publicKeyPresent,
    flags: tags.t,
    service: tags.s,
    notes: tags.n,
    hashAlgorithms: tags.h,
    valid: errors.length === 0,
    errors,
  };
}

export function parseDKIMSignatureHeader(header: string): DKIMSignature {
  const tags = splitTags(header);
  const signedHeaders = tags.h ? tags.h.split(':').map((item) => item.trim()).filter(Boolean) : undefined;
  return {
    raw: header,
    version: tags.v,
    algorithm: tags.a,
    signingDomain: tags.d,
    selector: tags.s,
    canonicalization: tags.c,
    signedHeaders,
    bodyHash: tags.bh,
    signature: tags.b,
    timestamp: tags.t,
    expiration: tags.x,
    identity: tags.i,
    bodyLength: tags.l,
    query: tags.q,
    copiedHeaderFields: tags.z,
    tags,
    cryptographicVerification: 'not_performed',
  };
}
