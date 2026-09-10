import { DMARCParseResult } from '@/types/domain';

const POLICIES = new Set(['none', 'quarantine', 'reject']);

export function isDmarcRecord(txt: string): boolean {
  return /^v\s*=\s*DMARC1\s*(;|$)/i.test(txt.trim());
}

export function parseDMARCRecord(record: string): DMARCParseResult {
  const errors: string[] = [];
  const tags: Record<string, string> = {};
  const parts = record.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      errors.push(`Malformed tag: ${trimmed}`);
      continue;
    }
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (tags[key]) {
      errors.push(`Duplicate tag: ${key}`);
    }
    tags[key] = value;
  }

  const version = tags.v;
  if (!version || version.toUpperCase() !== 'DMARC1') {
    errors.push('DMARC record must include v=DMARC1');
  }

  const policyRaw = tags.p?.toLowerCase();
  if (!policyRaw) {
    errors.push('DMARC record must include a p= policy');
  } else if (!POLICIES.has(policyRaw)) {
    errors.push(`Invalid p= policy: ${tags.p}`);
  }

  const spRaw = tags.sp?.toLowerCase();
  if (spRaw && !POLICIES.has(spRaw)) {
    errors.push(`Invalid sp= policy: ${tags.sp}`);
  }

  let percentage: number | undefined;
  if (tags.pct !== undefined) {
    const pct = Number(tags.pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      errors.push(`Invalid pct= value: ${tags.pct}`);
    } else {
      percentage = pct;
    }
  }

  const adkim = tags.adkim?.toLowerCase();
  const aspf = tags.aspf?.toLowerCase();
  if (adkim && adkim !== 'r' && adkim !== 's') errors.push(`Invalid adkim=: ${tags.adkim}`);
  if (aspf && aspf !== 'r' && aspf !== 's') errors.push(`Invalid aspf=: ${tags.aspf}`);

  const splitUris = (value?: string) =>
    value ? value.split(',').map((item) => item.trim()).filter(Boolean) : undefined;

  return {
    record,
    version,
    policy: policyRaw && POLICIES.has(policyRaw) ? (policyRaw as DMARCParseResult['policy']) : undefined,
    subdomainPolicy: spRaw && POLICIES.has(spRaw) ? (spRaw as DMARCParseResult['subdomainPolicy']) : undefined,
    percentage,
    dkimAlignment: adkim === 's' || adkim === 'r' ? adkim : undefined,
    spfAlignment: aspf === 's' || aspf === 'r' ? aspf : undefined,
    rua: splitUris(tags.rua),
    ruf: splitUris(tags.ruf),
    fo: tags.fo,
    adkim: tags.adkim,
    aspf: tags.aspf,
    tags,
    valid: errors.length === 0,
    errors,
  };
}
