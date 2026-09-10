import {
  DNSRecordType,
  Finding,
  DnssecInspection,
  NameserverAnalysis,
  SPFAnalysis,
  DMARCAnalysis,
} from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import {
  normalizeARecords,
  normalizeAAAARecords,
  normalizeCAARecords,
  normalizeCNAMERecords,
  normalizeMXRecords,
  normalizeNSRecords,
  normalizeSOARecord,
  normalizeTXTRecords,
} from '@/lib/dns/normalization/dns-normalizer';
import { analyzeSPF } from '@/lib/dns/analysis/spf-analyzer';
import { analyzeDMARC } from '@/lib/dns/analysis/dmarc-analyzer';
import { analyzeNameservers } from '@/lib/dns/analysis/nameserver-analyzer';
import { inspectDnssec } from '@/lib/dns/analysis/dnssec-inspector';
import { finding } from '@/lib/dns/analysis/findings';

export interface DNSAnalysisResult {
  domain: string;
  records: {
    a: ReturnType<typeof normalizeARecords>;
    aaaa: ReturnType<typeof normalizeAAAARecords>;
    cname: string[];
    mx: ReturnType<typeof normalizeMXRecords>;
    ns: ReturnType<typeof normalizeNSRecords>;
    txt: string[];
    soa: ReturnType<typeof normalizeSOARecord>;
    caa: ReturnType<typeof normalizeCAARecords>;
  };
  lookupStatus: Record<string, string>;
  findings: Finding[];
  nameservers: NameserverAnalysis;
  dnssec: DnssecInspection;
  spf: SPFAnalysis;
  dmarc: DMARCAnalysis;
}

export async function analyzeDNS(domain: string): Promise<DNSAnalysisResult> {
  const budget = new QueryBudget();
  const types = [
    DNSRecordType.A,
    DNSRecordType.AAAA,
    DNSRecordType.CNAME,
    DNSRecordType.MX,
    DNSRecordType.NS,
    DNSRecordType.TXT,
    DNSRecordType.SOA,
    DNSRecordType.CAA,
  ] as const;

  const lookups = await Promise.all(types.map((type) => resolveDNS(domain, type, { budget })));
  const byType = Object.fromEntries(types.map((type, index) => [type, lookups[index]]));

  const a = normalizeARecords(byType.A.records);
  const aaaa = normalizeAAAARecords(byType.AAAA.records);
  const cname = normalizeCNAMERecords(byType.CNAME.records);
  const mx = normalizeMXRecords(byType.MX.records);
  const ns = normalizeNSRecords(byType.NS.records);
  const txt = normalizeTXTRecords(byType.TXT.records);
  const soa = normalizeSOARecord(byType.SOA.records[0]);
  const caa = normalizeCAARecords(byType.CAA.records);

  const findings: Finding[] = [];
  const lookupStatus = Object.fromEntries(
    types.map((type) => [type, byType[type].status])
  );

  if (byType.A.status === 'success' && a.length > 0) {
    findings.push(
      finding('A_PRESENT', 'pass', 'dns', 'A records present', `${a.length} IPv4 address(es) observed.`, 'Address records were returned by this resolver.')
    );
  } else if (byType.A.status === 'empty' || (byType.A.status === 'success' && a.length === 0)) {
    findings.push(
      finding(
        'A_MISSING',
        cname.length > 0 ? 'info' : 'warning',
        'dns',
        'No A record',
        cname.length > 0 ? 'No A record; a CNAME is present.' : 'No IPv4 address was returned.',
        'Missing A is expected for some CNAME aliases or IPv6-only hosts. This is an observation from one resolver.'
      )
    );
  }

  if (byType.AAAA.status === 'success' && aaaa.length > 0) {
    findings.push(
      finding('AAAA_PRESENT', 'pass', 'dns', 'AAAA records present', `${aaaa.length} IPv6 address(es) observed.`, 'IPv6 address records were returned.')
    );
  } else if (byType.AAAA.status === 'empty' || byType.AAAA.status === 'success') {
    findings.push(
      finding(
        'AAAA_MISSING',
        'info',
        'dns',
        'No AAAA record',
        'No IPv6 address was returned.',
        'AAAA is optional. Absence is informational unless IPv6 is required.'
      )
    );
  }

  if (cname.length > 0) {
    findings.push(
      finding(
        'CNAME_PRESENT',
        'info',
        'dns',
        'CNAME observed',
        cname.join(', '),
        'A CNAME alias was returned. Apex CNAMEs are often problematic; this tool does not claim whether this name is an apex.'
      )
    );
  }

  if (mx.length === 0 && (byType.MX.status === 'empty' || byType.MX.status === 'success')) {
    findings.push(
      finding(
        'MX_MISSING',
        'warning',
        'dns',
        'No MX records',
        'No mail exchanger was published.',
        'Domains that send or receive mail usually publish MX records. Some setups fall back to the A/AAAA name.'
      )
    );
  } else if (mx.length === 1) {
    findings.push(
      finding('MX_SINGLE', 'info', 'dns', 'Single MX record', mx[0].exchange, 'One MX hostname was published. Redundancy is optional but common.')
    );
  } else if (mx.length > 1) {
    findings.push(
      finding('MX_MULTIPLE', 'pass', 'dns', 'Multiple MX records', `${mx.length} mail exchangers were published.`, 'Multiple MX records can provide redundancy. Priority values were not tested for liveness.')
    );
  }

  if (caa.length === 0 && (byType.CAA.status === 'empty' || byType.CAA.status === 'success')) {
    findings.push(
      finding(
        'CAA_MISSING',
        'info',
        'dns',
        'No CAA records',
        'No CAA policy was published.',
        'CAA is optional. It can restrict which certificate authorities may issue certificates for the domain.'
      )
    );
  } else if (caa.length > 0) {
    findings.push(
      finding('CAA_PRESENT', 'pass', 'dns', 'CAA records present', `${caa.length} CAA record(s) observed.`, 'CAA policy was returned. This tool does not evaluate certificate issuance.')
    );
  }

  if (soa) {
    findings.push(
      finding(
        'SOA_PRESENT',
        'info',
        'dns',
        'SOA record present',
        `Primary nameserver ${soa.nameserver}, serial ${soa.serial}.`,
        'SOA timings were observed from this resolver and were not validated against all authorities.'
      )
    );
    if (soa.refresh < 300) {
      findings.push(
        finding('SOA_REFRESH_LOW', 'info', 'dns', 'Low SOA refresh', `refresh=${soa.refresh}`, 'Very low refresh values can increase polling. This is informational.')
      );
    }
  } else if (byType.SOA.status === 'empty') {
    findings.push(
      finding('SOA_MISSING', 'warning', 'dns', 'No SOA record', 'SOA was not returned.', 'Apex names normally have an SOA. This may be a non-apex name or a resolver limitation.')
    );
  }

  const nameservers = await analyzeNameservers(domain, budget);
  const dnssec = await inspectDnssec(domain, budget);
  const spf = await analyzeSPF(domain, budget);
  const dmarc = await analyzeDMARC(domain, budget);

  return {
    domain,
    records: { a, aaaa, cname, mx, ns, txt, soa, caa },
    lookupStatus,
    findings: [...findings, ...nameservers.findings, ...dnssec.findings, ...spf.findings, ...dmarc.findings],
    nameservers,
    dnssec,
    spf,
    dmarc,
  };
}
