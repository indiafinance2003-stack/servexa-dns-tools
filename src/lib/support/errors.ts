/**
 * Support domain error types.
 *
 * These live in their own module so that pure rule helpers can throw/validate
 * without importing the persistence layer (and so unit tests can assert the
 * exact error codes returned by the API).
 */
export class SupportError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
    this.name = 'SupportError';
  }
}

export class TicketNotFoundError extends SupportError {
  constructor() {
    // 404 (not 403) even when the ticket exists but belongs to another account:
    // the API must not confirm the existence of another customer's ticket.
    super('The requested support ticket was not found.', 'TICKET_NOT_FOUND', 404);
  }
}

export class UnauthorizedTicketAccessError extends SupportError {
  constructor() {
    super('You do not have access to that support ticket.', 'UNAUTHORIZED_TICKET_ACCESS', 403);
  }
}

export class MessageNotFoundError extends SupportError {
  constructor() {
    super('The requested message was not found.', 'MESSAGE_NOT_FOUND', 404);
  }
}

export class UnauthorizedMessageAccessError extends SupportError {
  constructor() {
    super('You do not have access to that message.', 'UNAUTHORIZED_MESSAGE_ACCESS', 403);
  }
}

export class InvalidTicketStateError extends SupportError {
  constructor(message = "That action is not allowed in the ticket's current state.") {
    super(message, 'INVALID_TICKET_STATE', 409);
  }
}

export class SupportEntitlementRequiredError extends SupportError {
  constructor(message = 'Managed Support tickets require an active Managed Support plan.') {
    super(message, 'SUPPORT_ENTITLEMENT_REQUIRED', 403);
  }
}

export class SupportLimitReachedError extends SupportError {
  constructor(message = 'You have reached the open ticket limit for your plan.') {
    super(message, 'SUPPORT_LIMIT_REACHED', 429);
  }
}

export class ImpersonationWriteBlockedError extends SupportError {
  constructor() {
    super(
      'This action is unavailable while an administrator is viewing your account in read-only mode.',
      'IMPERSONATION_READ_ONLY',
      403
    );
  }
}