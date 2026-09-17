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
  // Pricing pages (Part 1)
  USE_DEMO_BILLING: boolean;
}

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
  };
}

export const config = getConfig();
