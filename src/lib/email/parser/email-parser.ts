import { config } from '@/lib/config';
import { RequestTooLargeError, ParserError } from '@/lib/errors/app-error';
import { EmailHeader, ParsedEmail } from '@/types/domain';
import { parseDKIMSignatureHeader } from '@/lib/dns/analysis/dkim-parser';
import { parseReceivedHeaders } from '@/lib/email/received/received-parser';
import { parseAuthenticationResults } from '@/lib/email/authentication/auth-results';

function unfoldAndSplit(raw: string): { headers: EmailHeader[]; errors: string[] } {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const headers: EmailHeader[] = [];
  const errors: string[] = [];
  let currentName = '';
  let currentValue = '';

  const push = () => {
    if (!currentName) return;
    if (Buffer.byteLength(currentValue, 'utf8') > config.MAX_INDIVIDUAL_HEADER_BYTES) {
      errors.push(`Header ${currentName} exceeded individual size limit and was truncated in analysis.`);
      currentValue = currentValue.slice(0, config.MAX_INDIVIDUAL_HEADER_BYTES);
    }
    headers.push({ name: currentName, value: currentValue.trim() });
  };

  for (const line of lines) {
    if (headers.length >= config.MAX_HEADER_COUNT && !currentName) {
      errors.push(`Header count exceeded ${config.MAX_HEADER_COUNT}; remaining headers were ignored.`);
      break;
    }
    if (line.length > config.MAX_LINE_LENGTH) {
      errors.push('A header line exceeded the maximum line length and was skipped.');
      continue;
    }
    if (/^[ \t]/.test(line)) {
      if (currentName) {
        currentValue += ' ' + line.trim();
      }
      continue;
    }
    if (line.trim() === '') {
      break;
    }
    if (headers.length >= config.MAX_HEADER_COUNT) {
      errors.push(`Header count exceeded ${config.MAX_HEADER_COUNT}; remaining headers were ignored.`);
      currentName = '';
      currentValue = '';
      break;
    }
    push();
    const colon = line.indexOf(':');
    if (colon <= 0) {
      errors.push(`Ignored malformed header line: ${line.slice(0, 80)}`);
      currentName = '';
      currentValue = '';
      continue;
    }
    currentName = line.slice(0, colon).trim();
    currentValue = line.slice(colon + 1);
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(currentName)) {
      errors.push(`Unusual header name: ${currentName}`);
    }
  }
  push();
  return { headers, errors };
}

function values(headers: EmailHeader[], name: string): string[] {
  return headers.filter((header) => header.name.toLowerCase() === name.toLowerCase()).map((header) => header.value);
}

function value(headers: EmailHeader[], name: string): string | undefined {
  return values(headers, name)[0];
}

export function parseEmailHeaders(rawHeaders: string): ParsedEmail {
  if (!rawHeaders || typeof rawHeaders !== 'string') {
    throw new ParserError('Email headers must be a non-empty string');
  }
  if (Buffer.byteLength(rawHeaders, 'utf8') > config.MAX_EMAIL_HEADER_BYTES) {
    throw new RequestTooLargeError(
      `Email headers exceed maximum size of ${config.MAX_EMAIL_HEADER_BYTES} bytes`,
      config.MAX_EMAIL_HEADER_BYTES
    );
  }

  const { headers, errors: parseErrors } = unfoldAndSplit(rawHeaders);

  const receivedValues = values(headers, 'received');
  const authValues = values(headers, 'authentication-results');
  const dkimValues = values(headers, 'dkim-signature');

  return {
    from: value(headers, 'from'),
    to: values(headers, 'to'),
    cc: values(headers, 'cc'),
    bcc: values(headers, 'bcc'),
    subject: value(headers, 'subject'),
    date: value(headers, 'date'),
    messageId: value(headers, 'message-id'),
    inReplyTo: value(headers, 'in-reply-to'),
    references: values(headers, 'references'),
    replyTo: value(headers, 'reply-to'),
    returnPath: value(headers, 'return-path'),
    contentType: value(headers, 'content-type'),
    userAgent: value(headers, 'user-agent') || value(headers, 'x-mailer'),
    mimeVersion: value(headers, 'mime-version'),
    headers,
    receivedHops: parseReceivedHeaders(receivedValues),
    authenticationResults: parseAuthenticationResults(authValues),
    receivedSpf: values(headers, 'received-spf'),
    dkimSignatures: dkimValues.map(parseDKIMSignatureHeader),
    arcHeaders: headers.filter((header) => header.name.toLowerCase().startsWith('arc-')),
    errors: parseErrors,
  };
}
