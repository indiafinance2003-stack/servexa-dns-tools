export enum AppErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_DOMAIN = 'INVALID_DOMAIN',
  DNS_TIMEOUT = 'DNS_TIMEOUT',
  NXDOMAIN = 'NXDOMAIN',
  SERVFAIL = 'SERVFAIL',
  REFUSED = 'REFUSED',
  DNS_ERROR = 'DNS_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  PARSER_ERROR = 'PARSER_ERROR',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  code: AppErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(AppErrorCode.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class InvalidDomainError extends AppError {
  constructor(domain: string, reason: string) {
    super(
      AppErrorCode.INVALID_DOMAIN,
      `Invalid domain: ${domain} - ${reason}`,
      400,
      { domain, reason }
    );
    this.name = 'InvalidDomainError';
  }
}

export class DNSError extends AppError {
  constructor(message: string, code?: AppErrorCode, details?: Record<string, unknown>) {
    super(code || AppErrorCode.DNS_ERROR, message, 503, details);
    this.name = 'DNSError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, retryAfter?: number) {
    super(
      AppErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      retryAfter ? { retryAfter } : undefined
    );
    this.name = 'RateLimitError';
  }
}

export class RequestTooLargeError extends AppError {
  constructor(message: string, maxSize?: number) {
    super(
      AppErrorCode.REQUEST_TOO_LARGE,
      message,
      413,
      maxSize ? { maxSize } : undefined
    );
    this.name = 'RequestTooLargeError';
  }
}

export class ParserError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(AppErrorCode.PARSER_ERROR, message, 400, details);
    this.name = 'ParserError';
  }
}
