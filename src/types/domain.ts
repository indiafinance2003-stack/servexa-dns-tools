export type FindingSeverity = 'pass' | 'info' | 'warning' | 'error';

export enum DNSRecordType {
  A = 'A',
  AAAA = 'AAAA',
  CNAME = 'CNAME',
  MX = 'MX',
  NS = 'NS',
  TXT = 'TXT',
  SOA = 'SOA',
  PTR = 'PTR',
  SRV = 'SRV',
  CAA = 'CAA',
}

export interface Finding {
  code: string;
  severity: FindingSeverity;
  category: string;
  title: string;
  summary: string;
  explanation: string;
  recommendation?: string;
  evidence?: Record<string, unknown>;
}

export interface AddressRecord {
  address: string;
  ttl?: number;
}

export interface MXRecord {
  priority: number;
  exchange: string;
  ttl?: number;
}

export interface NSRecord {
  nameserver: string;
  ttl?: number;
}

export interface SRVRecord {
  priority: number;
  weight: number;
  port: number;
  target: string;
  ttl?: number;
}

export interface CAARecord {
  flags: number;
  tag: string;
  value: string;
  ttl?: number;
}

export interface SOARecord {
  nameserver: string;
  hostmaster: string;
  serial: number;
  refresh: number;
  retry: number;
  expire: number;
  minimum: number;
  ttl?: number;
}

export type DNSLookupStatus =
  | 'success'
  | 'empty'
  | 'nxdomain'
  | 'servfail'
  | 'refused'
  | 'timeout'
  | 'error';

export interface DNSLookupResult {
  domain: string;
  recordType: DNSRecordType;
  records: unknown[];
  error?: string;
  status: DNSLookupStatus;
  queryTime: number;
  resolver?: string;
}

export interface SPFMechanism {
  type: string;
  qualifier: '+' | '-' | '~' | '?';
  value: string;
  raw: string;
}

export interface SPFModifier {
  name: string;
  value: string;
  raw: string;
}

export interface SPFParseResult {
  record: string;
  version?: string;
  valid: boolean;
  mechanisms: SPFMechanism[];
  modifiers: SPFModifier[];
  errors: string[];
}

export interface SPFAnalysis {
  domain: string;
  records: string[];
  parsed?: SPFParseResult;
  findings: Finding[];
  cryptographicOrSenderTestPerformed: false;
}

export interface DMARCParseResult {
  record: string;
  version?: string;
  policy?: 'none' | 'quarantine' | 'reject';
  subdomainPolicy?: 'none' | 'quarantine' | 'reject';
  percentage?: number;
  dkimAlignment?: 's' | 'r';
  spfAlignment?: 's' | 'r';
  rua?: string[];
  ruf?: string[];
  fo?: string;
  adkim?: string;
  aspf?: string;
  tags: Record<string, string>;
  valid: boolean;
  errors: string[];
}

export interface DMARCAnalysis {
  domain: string;
  lookupName: string;
  records: string[];
  parsed?: DMARCParseResult;
  findings: Finding[];
}

export interface DKIMDnsRecord {
  record: string;
  version?: string;
  keyType?: string;
  publicKey?: string;
  publicKeyPresent: boolean;
  flags?: string;
  service?: string;
  notes?: string;
  hashAlgorithms?: string;
  valid: boolean;
  errors: string[];
}

export interface DKIMSignature {
  raw: string;
  version?: string;
  algorithm?: string;
  signingDomain?: string;
  selector?: string;
  canonicalization?: string;
  signedHeaders?: string[];
  bodyHash?: string;
  signature?: string;
  timestamp?: string;
  expiration?: string;
  identity?: string;
  bodyLength?: string;
  query?: string;
  copiedHeaderFields?: string;
  tags: Record<string, string>;
  cryptographicVerification: 'not_performed';
}

export interface DKIMAnalysis {
  domain: string;
  selector: string;
  lookupName: string;
  records: string[];
  parsed?: DKIMDnsRecord;
  findings: Finding[];
  cryptographicVerification: 'not_performed';
}

export interface NameserverDetail {
  hostname: string;
  addresses: string[];
  resolved: boolean;
  lookupStatus: DNSLookupStatus;
  error?: string;
}

export interface NameserverAnalysis {
  nameservers: NameserverDetail[];
  findings: Finding[];
}

export type DnssecDetermination =
  | 'appears_enabled'
  | 'appears_absent'
  | 'could_not_be_determined'
  | 'possible_validation_failure';

export interface DnssecInspection {
  determination: DnssecDetermination;
  dsRecords: unknown[];
  dnskeyRecords: unknown[];
  rrsigObserved: boolean;
  cryptographicValidationPerformed: false;
  notes: string[];
  findings: Finding[];
}

export interface ResolverObservation {
  resolver: string;
  server: string;
  status: DNSLookupStatus;
  answers: unknown[];
  error?: string;
  queryTime: number;
}

export interface ResolverComparison {
  domain: string;
  recordType: DNSRecordType;
  observations: ResolverObservation[];
  differences: string[];
  terminology: 'Observed responses from selected public resolvers. This is not a global propagation measurement.';
}

export interface PTRLookupResult {
  ip: string;
  ptrs: string[];
  status: DNSLookupStatus;
  error?: string;
  queryTime: number;
}

export interface EmailHeader {
  name: string;
  value: string;
}

export interface ReceivedHop {
  index: number;
  from?: string;
  by?: string;
  with?: string;
  id?: string;
  protocol?: string;
  timestamp?: string;
  ipAddresses: string[];
  hostnames: string[];
  parseable: boolean;
  internalIps: string[];
  publicIps: string[];
  rawContent: string;
}

export interface ReportedAuthResult {
  authservId?: string;
  method: string;
  result: string;
  properties: Record<string, string>;
  raw: string;
}

export interface DomainRelationship {
  label: string;
  domains: string[];
  note: string;
  severity: FindingSeverity;
}

export interface ParsedEmail {
  from?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject?: string;
  date?: string;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  replyTo?: string;
  returnPath?: string;
  contentType?: string;
  userAgent?: string;
  mimeVersion?: string;
  headers: EmailHeader[];
  receivedHops: ReceivedHop[];
  authenticationResults: ReportedAuthResult[];
  receivedSpf: string[];
  dkimSignatures: DKIMSignature[];
  arcHeaders: EmailHeader[];
  errors: string[];
}

export interface EmailAnalysis {
  parsed: ParsedEmail;
  summary: {
    headerCount: number;
    hopCount: number;
    dkimSignatureCount: number;
    reportedAuthMethodCount: number;
  };
  senderRecipients: {
    from?: string;
    to: string[];
    cc: string[];
    replyTo?: string;
    returnPath?: string;
  };
  authentication: {
    reportedByReceivingServer: ReportedAuthResult[];
    detectedEvidence: {
      dkimSignatures: DKIMSignature[];
      receivedSpf: string[];
      arcHeaderCount: number;
    };
    verificationPerformedByThisTool: {
      spf: 'not_performed';
      dkim: 'not_performed';
      dmarc: 'not_performed';
      note: string;
    };
  };
  receivedChain: {
    hops: ReceivedHop[];
    chronologicalNote: string;
  };
  domains: DomainRelationship[];
  metadata: Record<string, string | string[] | undefined>;
  observations: Finding[];
  technicalDetails: {
    headers: EmailHeader[];
  };
}

/* -------------------------------------------------------------------------- */
/* Part 1 web/TLS diagnostics                                                  */
/* -------------------------------------------------------------------------- */

export interface CertificateDetails {
  subject: string;
  commonName?: string;
  issuer: string;
  issuerCommonName?: string;
  altNames: string[];
  validFrom?: string;
  validTo?: string;
  /** Whole days until `validTo`; negative when the certificate has expired. */
  daysRemaining: number | null;
  serialNumber?: string;
  fingerprintSha256?: string;
  isCA: boolean;
  selfSigned: boolean;
}

export interface CertificateChainEntry {
  depth: number;
  subject: string;
  issuer: string;
  validFrom?: string;
  validTo?: string;
  isCA: boolean;
  selfSigned: boolean;
  fingerprintSha256?: string;
}

export type CertificateVerificationStatus = 'trusted' | 'untrusted' | 'expired' | 'not_yet_valid';

export interface SslCheckResult {
  hostname: string;
  port: number;
  inspectedAt: string;
  /** The address actually contacted, from the validated public address set. */
  connectedAddress: string;
  /**
   * The Node.js TLS stack's chain-verification verdict for the certificate the
   * server presented. It is not an endorsement of the site.
   */
  chainTrusted: boolean;
  verificationError: string | null;
  /** Whether the hostname identity check (SAN/CN) passed. */
  hostnameCovered: boolean;
  protocol: string | null;
  cipher: string | null;
  certificate: CertificateDetails | null;
  chain: CertificateChainEntry[];
  handshakeTimeMs: number;
  findings: Finding[];
}

/* -------------------------------------------------------------------------- */
/* Part 1 HTTP / website diagnostics                                           */
/* -------------------------------------------------------------------------- */

export interface HttpHeaderEntry {
  name: string;
  value: string;
}

export interface HttpRedirectHop {
  from: string;
  to: string;
  statusCode: number;
  followed: boolean;
  reason?: string;
}

export interface HttpHeaderCheckResult {
  requestedUrl: string;
  finalUrl: string;
  protocol: 'http' | 'https';
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  headers: HttpHeaderEntry[];
  redirects: HttpRedirectHop[];
  redirectStopReason?: string;
  remoteAddress: string;
  timingMs: number;
  bodyBytes: number;
  bodyTruncated: boolean;
  /** First bytes of the body as text; never executed or rendered as markup. */
  bodyPreview: string | null;
  notes: string[];
}

export interface SecurityHeaderCheck {
  name: string;
  present: boolean;
  value?: string;
  severity: FindingSeverity;
  summary: string;
  explanation: string;
  recommendation?: string;
}

export interface WebsiteSecurityHeadersResult {
  finalUrl: string;
  statusCode: number;
  https: boolean;
  checks: SecurityHeaderCheck[];
  score: { present: number; missing: number; total: number };
  findings: Finding[];
  notes: string[];
}

export interface WebsiteAvailabilityResult {
  requestedUrl: string;
  finalUrl: string;
  reachable: boolean;
  statusCode: number | null;
  statusMessage: string | null;
  protocol: 'http' | 'https' | null;
  httpVersion: string | null;
  totalTimeMs: number;
  redirects: HttpRedirectHop[];
  redirectStopReason?: string;
  serverHeader: string | null;
  contentType: string | null;
  contentLength: string | null;
  httpToHttpsRedirectObserved: boolean;
  findings: Finding[];
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/* Part 1 DNS diagnostics                                                      */
/* -------------------------------------------------------------------------- */

export interface DelegationObservation {
  label: string;
  severity: FindingSeverity;
  detail: string;
}

export interface DelegationCheckResult {
  domain: string;
  nameservers: NSRecord[];
  /** Addresses each nameserver hostname resolves to, as observed. */
  nameserverAddresses: Array<{ nameserver: string; addresses: string[]; error?: string }>;
  soa: SOARecord | null;
  /** The SOA MNAME field and what could be observed about it. */
  primaryNameserver: {
    name: string | null;
    appearsInNsRecords: boolean | null;
    resolvesToAddress: boolean | null;
    addresses: string[];
  };
  singleProvider: boolean | null;
  observations: DelegationObservation[];
  findings: Finding[];
  queryTimeMs: number;
  notes: string[];
}

export interface PropagationResolverResult {
  resolver: string;
  server: string;
  status: DNSLookupStatus;
  answers: string[];
  error?: string;
  queryTimeMs: number;
}

export interface PropagationCheckResult {
  domain: string;
  recordType: DNSRecordType;
  results: PropagationResolverResult[];
  /** Values returned by every resolver that answered successfully. */
  consensus: string[];
  /** Values returned by at least one resolver but not by all successful ones. */
  divergent: string[];
  agreement: boolean;
  /** Fraction of resolvers that answered successfully (0-1). */
  responseRate: number;
  findings: Finding[];
  notes: string[];
}

export interface EmailDomainHealthSection {
  key: 'mx' | 'spf' | 'dmarc' | 'dkim' | 'ptr';
  title: string;
  status: FindingSeverity;
  summary: string;
  details: string[];
  findings: Finding[];
}

export interface EmailDomainHealthResult {
  domain: string;
  selector: string | null;
  /** True only when the DKIM section is present because a selector was supplied. */
  dkimChecked: boolean;
  sections: EmailDomainHealthSection[];
  overallStatus: FindingSeverity;
  findings: Finding[];
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/* Part 1 domain registration information (RDAP)                               */
/* -------------------------------------------------------------------------- */

export interface RdapEvent {
  action: string;
  date: string;
}

export interface RdapNameserver {
  name: string;
  addresses: string[];
}

export interface RdapContact {
  role: string;
  /** Only organization names; redacted personal fields are omitted. */
  organization: string | null;
  /** Only present when the registry publishes it unredacted. */
  email: string | null;
}

export interface DomainInfoResult {
  domain: string;
  /** The RDAP endpoint that produced this record. */
  source: string;
  handle: string | null;
  status: string[];
  registrar: string | null;
  events: RdapEvent[];
  nameservers: RdapNameserver[];
  dnssecSigned: boolean | null;
  contacts: RdapContact[];
  notes: string[];
}
