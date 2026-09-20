/**
 * Diagnostic context attached to a support ticket started from a tool.
 *
 * Only explicitly whitelisted, non-sensitive fields are ever persisted. Raw
 * email headers are never stored (the email header analyzer is intentionally
 * not saveable), and no free-form diagnostic payload is copied across.
 *
 * This module is deliberately free of database/auth imports so it can be unit
 * tested as pure input validation.
 */

export interface DiagnosticContext {
  /** Tool identifier, e.g. 'dns_lookup' or 'email_analyze'. */
  tool: string | null;
  /** The domain or hostname the customer was investigating. */
  domain: string | null;
  /** One-line summary of the observed finding (no raw payloads). */
  findingSummary: string | null;
  /** Finding counts by severity, when the tool produced them. */
  findingCounts: { error: number; warning: number; info: number; pass: number } | null;
  /** Tool-side reference/identifier for the diagnostic run, if any. */
  diagnosticReference: string | null;
  /** ISO timestamp of the diagnostic run. */
  capturedAt: string | null;
}

export const MAX_CONTEXT_FIELD_LENGTH = 200;
export const MAX_FINDING_SUMMARY_LENGTH = 400;

const TOOL_PATTERN = /^[a-z0-9_]{1,40}$/;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/** Removes control characters and collapses whitespace so stored context is
 * safe to render and cannot smuggle newlines/escape sequences into the UI. */
export function sanitizeContextText(value: string, maxLength: number): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function optionalString(value: unknown, maxLength = MAX_CONTEXT_FIELD_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = sanitizeContextText(value, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeDomain(value: unknown): string | null {
  const candidate = optionalString(value)?.toLowerCase().replace(/\.$/, '') ?? null;
  if (!candidate) return null;
  return DOMAIN_PATTERN.test(candidate) ? candidate : null;
}

function sanitizeCounts(value: unknown): DiagnosticContext['findingCounts'] {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const keys = ['error', 'warning', 'info', 'pass'] as const;
  const counts = { error: 0, warning: 0, info: 0, pass: 0 };
  let sawNumber = false;
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      counts[key] = Math.min(Math.floor(raw), 10_000);
      sawNumber = true;
    }
  }
  return sawNumber ? counts : null;
}

/**
 * Builds a sanitized diagnostic context from untrusted input. Unknown keys are
 * dropped entirely, so a client cannot store arbitrary data on a ticket.
 */
export function buildDiagnosticContext(input: unknown): DiagnosticContext | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;

  const tool = optionalString(record.tool);
  const context: DiagnosticContext = {
    tool: tool && TOOL_PATTERN.test(tool) ? tool : null,
    domain: sanitizeDomain(record.domain),
    findingSummary: optionalString(record.findingSummary, MAX_FINDING_SUMMARY_LENGTH),
    findingCounts: sanitizeCounts(record.findingCounts),
    diagnosticReference: (() => {
      const reference = optionalString(record.diagnosticReference);
      return reference && REFERENCE_PATTERN.test(reference) ? reference : null;
    })(),
    capturedAt: (() => {
      const raw = optionalString(record.capturedAt);
      if (!raw) return null;
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    })(),
  };

  const hasContent =
    context.tool !== null ||
    context.domain !== null ||
    context.findingSummary !== null ||
    context.findingCounts !== null ||
    context.diagnosticReference !== null;

  return hasContent ? context : null;
}

/**
 * Re-reads a stored context value. Rows written before a field existed, or
 * hand-edited rows, are re-sanitized rather than trusted.
 */
export function parseDiagnosticContext(value: unknown): DiagnosticContext | null {
  return buildDiagnosticContext(value);
}

/** Short, customer-safe description of the diagnostic context. */
export function describeDiagnosticContext(context: DiagnosticContext | null): string | null {
  if (!context) return null;
  const parts: string[] = [];
  if (context.tool) parts.push(context.tool.replace(/_/g, ' '));
  if (context.domain) parts.push(context.domain);
  if (context.findingCounts) {
    const { error, warning, info, pass } = context.findingCounts;
    parts.push(`${error} error / ${warning} warning / ${info} info / ${pass} pass`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
