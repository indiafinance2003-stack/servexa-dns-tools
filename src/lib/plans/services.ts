/**
 * Public service catalogue.
 *
 * These definitions are the single source of truth for the public
 * `/services/*` pages. Each one states explicit boundaries so the site never
 * promises development work, unlimited effort, or capabilities that do not
 * exist yet.
 *
 * `status` distinguishes real, current offerings from planned ones:
 *   - 'available' → covered by Managed Support today
 *   - 'planned'   → documented architecture, not delivered today
 */

export type ServiceStatus = 'available' | 'planned';

export interface ServiceDefinition {
  slug: string;
  title: string;
  summary: string;
  /** What the service covers (performed by Ravelyth). */
  includes: string[];
  /** Explicit exclusions — this is what we do not do. */
  excludes: string[];
  /** Information to collect before requesting help. */
  collect: string[];
  status: ServiceStatus;
  /** Diagnostic tools that help with this service. */
  relatedTools: Array<{ label: string; href: string }>;
  /** Knowledge Base article slugs that relate to this service. */
  relatedArticles: string[];
}

export const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  {
    slug: 'dns-management',
    title: 'DNS Management',
    summary: 'DNS setup, record changes, nameserver changes and DNS migration performed by Ravelyth.',
    includes: [
      'Initial DNS setup and zone configuration',
      'A, AAAA, CNAME, MX, TXT, NS, SRV and CAA record changes',
      'Nameserver changes and delegation verification',
      'DNS migration between providers with a rollback plan',
      'DNS troubleshooting and propagation investigation',
      'SPF, DKIM and DMARC record configuration and troubleshooting',
    ],
    excludes: [
      'Registering or paying for domains on your behalf',
      'Overriding a registrar or DNS provider outage',
      'Writing application code that consumes DNS records',
    ],
    collect: [
      'The exact domain and the record (or record type) involved',
      'Current nameservers and, if known, previous nameservers',
      'What you expected to resolve and what resolves instead',
      'When the change was made, in UTC',
    ],
    status: 'available',
    relatedTools: [
      { label: 'DNS Lookup', href: '/dns/lookup' },
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'Resolver Comparison', href: '/dns/resolvers' },
    ],
    relatedArticles: ['dns-propagation-not-updating', 'nameserver-change-checklist'],
  },
  {
    slug: 'email-management',
    title: 'Email Management',
    summary: 'Business email setup and delivery troubleshooting for Gmail, Google Workspace and Outlook.',
    includes: [
      'Business email setup and mailbox routing',
      'Gmail / Google Workspace and Outlook configuration troubleshooting',
      'MX record problems and mail host routing',
      'SMTP-related troubleshooting for existing mail servers',
      'Delivery, bounce and rejection investigation',
      'SPF, DKIM and DMARC configuration and troubleshooting',
      'Email header investigation to locate the failing hop',
    ],
    excludes: [
      'Guaranteeing inbox placement at a third-party mailbox provider',
      'Recovering mail from an account we do not control',
      'Developing mail-sending application code',
    ],
    collect: [
      'The sending domain and the receiving provider',
      'The exact bounce or rejection message',
      'Full raw headers of one affected message (beware of personal data)',
      'Whether the problem affects all recipients or one provider',
    ],
    status: 'available',
    relatedTools: [
      { label: 'SPF Checker', href: '/dns/spf' },
      { label: 'DKIM Checker', href: '/dns/dkim' },
      { label: 'DMARC Checker', href: '/dns/dmarc' },
      { label: 'Email Header Analyzer', href: '/email/analyze' },
    ],
    relatedArticles: ['email-delivery-issues', 'spf-dkim-dmarc-basics'],
  },
  {
    slug: 'wordpress-management',
    title: 'WordPress Management',
    summary: 'WordPress management and troubleshooting — not WordPress development or coding.',
    includes: [
      'WordPress error diagnosis (500, 502, 503, white screen)',
      'Plugin and theme conflict investigation',
      'Theme and configuration problems',
      'Login and wp-admin access problems',
      'PHP version and compatibility troubleshooting',
      'SSL/HTTPS issues on WordPress sites',
      'Migration assistance between hosts',
      'Backup and restore assistance',
      'Basic performance and security troubleshooting',
    ],
    excludes: [
      'Custom theme or plugin development',
      'Writing or fixing application code',
      'Building new websites or redesigns',
      'Guaranteed malware removal beyond diagnosis and standard remediation',
    ],
    collect: [
      'The exact error shown in the browser and in the server log if available',
      'The WordPress, PHP and MySQL/MariaDB versions',
      'Whether the site worked before a specific change',
      'The plugins and theme currently active',
    ],
    status: 'available',
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'Email Header Analyzer', href: '/email/analyze' },
    ],
    relatedArticles: ['wordpress-500-502-503-errors', 'wordpress-login-admin-issues'],
  },
  {
    slug: 'vps-management',
    title: 'VPS / Basic Server Management',
    summary: 'Small, well-defined operational tasks on your VPS — not infrastructure engineering.',
    includes: [
      'Disk space investigation and safe cleanup',
      'Log rotation and log cleanup',
      'Basic service and process checks',
      'Basic resource investigation (CPU, memory, disk, load)',
      'Small configuration fixes within the existing setup',
      'Basic SSL/HTTPS and web server troubleshooting',
    ],
    excludes: [
      'Major infrastructure redesign or architecture projects',
      'Advanced DevOps work, complex deployments and CI/CD builds',
      'Application development of any kind',
      'Managing infrastructure outside the agreed scope for your server',
    ],
    collect: [
      'The provider, plan and operating system of the server',
      'The exact command output or error message you see',
      'Recent changes made on the server',
      'Whether the issue affects every service or one site',
    ],
    status: 'available',
    relatedTools: [
      { label: 'PTR Lookup', href: '/dns/ptr' },
      { label: 'DNS Health', href: '/dns/analyze' },
    ],
    relatedArticles: ['vps-disk-space-full', 'vps-basic-hardening'],
  },
  {
    slug: 'ssl-management',
    title: 'SSL / HTTPS Management',
    summary: 'Diagnosing certificate, mixed-content and HTTPS configuration problems.',
    includes: [
      'Certificate issuance and renewal troubleshooting',
      'Wrong-domain or expired certificate diagnosis',
      'Mixed content and redirect loop troubleshooting',
      'HTTP to HTTPS redirect configuration',
      'Certificate chain and hostname mismatch investigation',
    ],
    excludes: [
      'Purchasing certificates on your behalf',
      'Fixing insecure application code that breaks HTTPS',
      'Guaranteeing browser-specific behaviour we cannot reproduce',
    ],
    collect: [
      'The exact hostname and the browser error message',
      'Whether the problem affects all visitors or one network',
      'The certificate issuer and expiry date if visible',
      'Whether a redirect, reverse proxy or CDN sits in front of the site',
    ],
    status: 'available',
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'DNS Lookup', href: '/dns/lookup' },
    ],
    relatedArticles: ['ssl-certificate-problems', 'dns-propagation-not-updating'],
  },
  {
    slug: 'website-migration',
    title: 'Website Migration',
    summary: 'Assisted migration of a website between hosts, including DNS and email cutover planning.',
    includes: [
      'Pre-migration checklist and cutover planning',
      'Document root, database and file transfer assistance',
      'DNS and nameserver cutover coordination',
      'Email/MX routing checks during migration',
      'Post-migration verification of DNS, HTTPS and mail',
    ],
    excludes: [
      'Migrating unlimited data or an undefined number of sites',
      'Migrating custom applications without a documented setup',
      'Accepting responsibility for data the customer has not backed up',
      'Provider-side transfer limits or fees',
    ],
    collect: [
      'Source and destination hosting provider details',
      'Whether email is hosted with the website or separately',
      'The current nameservers and the planned nameservers',
      'Any custom application or database configuration',
    ],
    status: 'available',
    relatedTools: [
      { label: 'DNS Lookup', href: '/dns/lookup' },
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'Resolver Comparison', href: '/dns/resolvers' },
    ],
    relatedArticles: ['nameserver-change-checklist', 'email-delivery-issues'],
  },
];

export function findService(slug: string): ServiceDefinition | null {
  return SERVICE_DEFINITIONS.find((service) => service.slug === slug) ?? null;
}

export function serviceSlugs(): string[] {
  return SERVICE_DEFINITIONS.map((service) => service.slug);
}