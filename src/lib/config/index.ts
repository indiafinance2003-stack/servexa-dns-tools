interface Config {
  NODE_ENV: 'development' | 'production' | 'test';
  APP_URL: string;
  APP_VERSION: string;
  DNS_TIMEOUT_MS: number;
  DNS_QUERY_TIMEOUT_MS: number;
  MAX_REQUEST_BODY_BYTES: number;
  MAX_EMAIL_HEADER_BYTES: number;
  MAX_INDIVIDUAL_HEADER_BYTES: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  MAX_HEADER_COUNT: number;
  MAX_LINE_LENGTH: number;
  MAX_DNS_QUERIES_PER_REQUEST: number;
  MAX_SPF_INCLUDE_LOOKUPS: number;
  TRUST_PROXY_HEADERS: boolean;
  HTTP_REQUEST_TIMEOUT_MS: number;
  HTTP_MAX_RESPONSE_BYTES: number;
  HTTP_MAX_REDIRECTS: number;
  HTTP_MAX_ADDRESS_ATTEMPTS: number;
  TLS_CONNECT_TIMEOUT_MS: number;
  RDAP_TIMEOUT_MS: number;
  MAX_PROPAGATION_RESOLVERS: number;
  // Part 1 pricing pages
  USE_DEMO_BILLING: boolean;
  // Part 2 — Managed Support, billing foundation and support limits.
  // The Managed Support price lives here (and only here) so plan changes are a
  // configuration change rather than a code change. Amounts are integer minor
  // units (paise for INR) so money is never stored as a float.
  MANAGED_SUPPORT_PRICE_MINOR: number;
  MANAGED_SUPPORT_CURRENCY: string;
  MANAGED_SUPPORT_BILLING_INTERVAL: BillingIntervalConfig;
  MANAGED_SUPPORT_QUARTERLY_PRICE_MINOR: number | null;
  MANAGED_SUPPORT_YEARLY_PRICE_MINOR: number | null;
  // Which billing/payment provider is wired up. Empty means NO gateway is
  // configured: the application must then never report a successful payment.
  BILLING_PROVIDER: string;
  // Grace period is an open commercial decision; 0 means "not decided".
  BILLING_GRACE_PERIOD_DAYS: number;
  SUPPORT_MAX_OPEN_TICKETS: number;
  SUPPORT_MAX_OPEN_PUBLIC_REQUESTS: number;
  SUPPORT_TICKET_RATE_LIMIT_MAX: number;
  SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS: number;
    SUPPORT_INCLUDE_INTERNAL_RESPONSES: boolean;
  // Part 3 — Control/Agent/licensing foundation. Empty prefix/config values
  // keep every Control capability clearly "not configured".
  CONTROL_LICENSE_KEY_PREFIX: string;
  CONTROL_ACTIVATION_TTL_DAYS: number;
  CONTROL_SERVER_TOKEN_PREFIX: string;
  CONTROL_AGENT_NONCE_TTL_MS: number;
    CONTROL_AGENT_NONCE_MAX_PER_SERVER: number;
  CONTROL_AGENT_NONCE_CLEANUP_INTERVAL_MS: number;
  CONTROL_PROVIDER_TENANT_ISOLATION: boolean;
  // Part 4 — internal operations.
  OWNER_EMAIL: string;
  OWNER_IMPERSONATION_TTL_MINUTES: number;
  AUDIT_LOG_RETENTION_DAYS: number;
  // Monetization: ads are only rendered when explicitly enabled AND allowed by
  // the deployed Content-Security-Policy.
  ADSENSE_CLIENT_ID: string;
  // Transactional email is NOT configured by default. Leaving EMAIL_PROVIDER
  // empty means the application must never claim that an email was delivered.
  EMAIL_PROVIDER: string;
  EMAIL_FROM: string;
  // Invoice numbering prefix (Part 4 internal billing operations).
  INVOICE_NUMBER_PREFIX: string;
  // Part 6 — Ravelyth Talent.
  // Private directory for candidate documents. Must NOT be inside /public.
  TALENT_STORAGE_DIR: string;
  TALENT_MAX_RESUME_BYTES: number;
  // Public application submissions are unauthenticated, so they are throttled
  // per client identity rather than per account.
  TALENT_APPLICATION_RATE_LIMIT_MAX: number;
  TALENT_APPLICATION_RATE_LIMIT_WINDOW_MS: number;
  // Maximum simultaneously open applications allowed per candidate email.
  TALENT_MAX_OPEN_APPLICATIONS_PER_CANDIDATE: number;
}

export type BillingIntervalConfig = 'monthly' | 'quarterly' | 'yearly';

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseEnvBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === 'true';
}

/** Optional numeric setting: returns null when unset/blank so an open decision
 * (for example a not-yet-finalized quarterly price) stays explicitly "unset"
 * instead of silently becoming 0. */
function parseEnvOptionalInt(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return null;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Non-negative integer settings (0 is meaningful, e.g. "grace period not yet
 * decided"). */
function parseEnvNonNegativeInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseEnvInterval(name: string, fallback: BillingIntervalConfig): BillingIntervalConfig {
  const raw = (process.env[name] || '').trim().toLowerCase();
  if (raw === 'monthly' || raw === 'quarterly' || raw === 'yearly') return raw;
  return fallback;
}

function getConfig(): Config {
  const nodeEnv = (process.env.NODE_ENV || 'development') as
    | 'development'
    | 'production'
    | 'test';

  return {
    NODE_ENV: nodeEnv,
    APP_URL: process.env.APP_URL || 'https://ravelyth.in',
    APP_VERSION: process.env.APP_VERSION || '0.1.0',
    DNS_TIMEOUT_MS: parseEnvInt('DNS_TIMEOUT_MS', 10000),
    DNS_QUERY_TIMEOUT_MS: parseEnvInt('DNS_QUERY_TIMEOUT_MS', 8000),
    MAX_REQUEST_BODY_BYTES: parseEnvInt('MAX_REQUEST_BODY_BYTES', 1048576),
    MAX_EMAIL_HEADER_BYTES: parseEnvInt('MAX_EMAIL_HEADER_BYTES', 262144),
    MAX_INDIVIDUAL_HEADER_BYTES: parseEnvInt('MAX_INDIVIDUAL_HEADER_BYTES', 16000),
    RATE_LIMIT_WINDOW_MS: parseEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
    RATE_LIMIT_MAX_REQUESTS: parseEnvInt('RATE_LIMIT_MAX_REQUESTS', 60),
    MAX_HEADER_COUNT: parseEnvInt('MAX_HEADER_COUNT', 150),
    MAX_LINE_LENGTH: parseEnvInt('MAX_LINE_LENGTH', 998),
    MAX_DNS_QUERIES_PER_REQUEST: parseEnvInt('MAX_DNS_QUERIES_PER_REQUEST', 32),
    MAX_SPF_INCLUDE_LOOKUPS: parseEnvInt('MAX_SPF_INCLUDE_LOOKUPS', 10),
    TRUST_PROXY_HEADERS: parseEnvBool('TRUST_PROXY_HEADERS', nodeEnv === 'production'),
    // Outbound web/TLS diagnostics. Timeouts are a total budget per request
    // (including redirects) so a single call cannot occupy a worker.
    HTTP_REQUEST_TIMEOUT_MS: parseEnvInt('HTTP_REQUEST_TIMEOUT_MS', 10000),
    HTTP_MAX_RESPONSE_BYTES: parseEnvInt('HTTP_MAX_RESPONSE_BYTES', 65536),
    HTTP_MAX_REDIRECTS: parseEnvInt('HTTP_MAX_REDIRECTS', 3),
    HTTP_MAX_ADDRESS_ATTEMPTS: parseEnvInt('HTTP_MAX_ADDRESS_ATTEMPTS', 3),
    TLS_CONNECT_TIMEOUT_MS: parseEnvInt('TLS_CONNECT_TIMEOUT_MS', 10000),
    RDAP_TIMEOUT_MS: parseEnvInt('RDAP_TIMEOUT_MS', 10000),
    MAX_PROPAGATION_RESOLVERS: parseEnvInt('MAX_PROPAGATION_RESOLVERS', 6),
    // Pricing pages: in dev/part-1 we never hit a live billing provider.
    USE_DEMO_BILLING: parseEnvBool('USE_DEMO_BILLING', nodeEnv !== 'production'),
    // ---------------------------------------------------------------------
    // Part 2 — Managed Support / billing foundation.
    // 59900 paise = ₹599.00 per month. This default is the single source of
    // truth for the Managed Support price; nothing else hard-codes it.
    // ---------------------------------------------------------------------
    MANAGED_SUPPORT_PRICE_MINOR: parseEnvInt('MANAGED_SUPPORT_PRICE_MINOR', 59900),
    MANAGED_SUPPORT_CURRENCY: (process.env.MANAGED_SUPPORT_CURRENCY || 'INR').trim().toUpperCase(),
    MANAGED_SUPPORT_BILLING_INTERVAL: parseEnvInterval('MANAGED_SUPPORT_BILLING_INTERVAL', 'monthly'),
    // Quarterly/yearly pricing is an unresolved commercial decision: unset means
    // "not offered yet", never a silently invented number.
    MANAGED_SUPPORT_QUARTERLY_PRICE_MINOR: parseEnvOptionalInt('MANAGED_SUPPORT_QUARTERLY_PRICE_MINOR'),
    MANAGED_SUPPORT_YEARLY_PRICE_MINOR: parseEnvOptionalInt('MANAGED_SUPPORT_YEARLY_PRICE_MINOR'),
    BILLING_PROVIDER: (process.env.BILLING_PROVIDER || '').trim(),
    BILLING_GRACE_PERIOD_DAYS: parseEnvNonNegativeInt('BILLING_GRACE_PERIOD_DAYS', 0),
    SUPPORT_MAX_OPEN_TICKETS: parseEnvInt('SUPPORT_MAX_OPEN_TICKETS', 5),
    // Operational (not commercial) abusion limit for accounts without Managed
    // Support that use the public request flow. Configurable.
    SUPPORT_MAX_OPEN_PUBLIC_REQUESTS: parseEnvInt('SUPPORT_MAX_OPEN_PUBLIC_REQUESTS', 2),
    SUPPORT_TICKET_RATE_LIMIT_MAX: parseEnvInt('SUPPORT_TICKET_RATE_LIMIT_MAX', 10),
    SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS: parseEnvInt('SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
            SUPPORT_INCLUDE_INTERNAL_RESPONSES: parseEnvBool('SUPPORT_INCLUDE_INTERNAL_RESPONSES', false),
    // Part 3 — Control/Agent/licensing foundation.
    CONTROL_LICENSE_KEY_PREFIX: (process.env.CONTROL_LICENSE_KEY_PREFIX || 'RVLY-LIC').trim(),
    CONTROL_ACTIVATION_TTL_DAYS: parseEnvInt('CONTROL_ACTIVATION_TTL_DAYS', 365),
    CONTROL_SERVER_TOKEN_PREFIX: (process.env.CONTROL_SERVER_TOKEN_PREFIX || 'rvly-srv').trim(),
        CONTROL_AGENT_NONCE_TTL_MS: parseEnvInt('CONTROL_AGENT_NONCE_TTL_MS', 5 * 60 * 1000),
    CONTROL_AGENT_NONCE_MAX_PER_SERVER: parseEnvInt('CONTROL_AGENT_NONCE_MAX_PER_SERVER', 100),
    CONTROL_AGENT_NONCE_CLEANUP_INTERVAL_MS: parseEnvInt('CONTROL_AGENT_NONCE_CLEANUP_INTERVAL_MS', 60 * 60 * 1000),
    CONTROL_PROVIDER_TENANT_ISOLATION: parseEnvBool('CONTROL_PROVIDER_TENANT_ISOLATION', true),
    // Part 4 — internal operations.
    OWNER_EMAIL: (process.env.OWNER_EMAIL || '').trim(),
    OWNER_IMPERSONATION_TTL_MINUTES: parseEnvInt('OWNER_IMPERSONATION_TTL_MINUTES', 30),
    AUDIT_LOG_RETENTION_DAYS: parseEnvInt('AUDIT_LOG_RETENTION_DAYS', 365),
    ADSENSE_CLIENT_ID: (process.env.ADSENSE_CLIENT_ID || '').trim(),
    // Transactional email provider boundary. Empty = no delivery is possible,
    // so no notification may claim an email was sent.
    EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || '').trim(),
    EMAIL_FROM: (process.env.EMAIL_FROM || '').trim(),
    INVOICE_NUMBER_PREFIX: (process.env.INVOICE_NUMBER_PREFIX || 'RVLY').trim(),
    // Part 6 — Ravelyth Talent.
    // Default sits beside the application (never under /public) and is outside
    // version control. Candidate documents are written with owner-only
    // permissions and are only ever read through an authorised server route.
    TALENT_STORAGE_DIR: (
      process.env.TALENT_STORAGE_DIR || '.ravelyth-private/talent-documents'
    ).trim(),
    TALENT_MAX_RESUME_BYTES: parseEnvInt('TALENT_MAX_RESUME_BYTES', 5 * 1024 * 1024),
    TALENT_APPLICATION_RATE_LIMIT_MAX: parseEnvInt('TALENT_APPLICATION_RATE_LIMIT_MAX', 5),
    TALENT_APPLICATION_RATE_LIMIT_WINDOW_MS: parseEnvInt(
      'TALENT_APPLICATION_RATE_LIMIT_WINDOW_MS',
      60 * 60 * 1000
    ),
    TALENT_MAX_OPEN_APPLICATIONS_PER_CANDIDATE: parseEnvInt(
      'TALENT_MAX_OPEN_APPLICATIONS_PER_CANDIDATE',
      10
    ),
  };
}

export const config = getConfig();
