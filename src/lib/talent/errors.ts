/**
 * Ravelyth Talent domain errors.
 *
 * Kept in their own module so pure rule helpers and services can throw stable
 * codes without importing the HTTP layer, and so unit tests can assert the exact
 * error a caller receives.
 */
export class TalentError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
    this.name = 'TalentError';
  }
}

/** A job, candidate, application, interview or placement could not be found. */
export class TalentNotFoundError extends TalentError {
  constructor(resource = 'record') {
    // 404 rather than 403 so an id from another context cannot be probed.
    super(`The requested ${resource} was not found.`, 'TALENT_NOT_FOUND', 404);
  }
}

/** The requested pipeline transition is not permitted. */
export class TalentInvalidTransitionError extends TalentError {
  constructor(from: string, to: string) {
    super(
      `An application cannot move from ${from} to ${to}. Move it through the pipeline in order.`,
      'TALENT_INVALID_TRANSITION',
      409
    );
  }
}

/** A client submission was attempted before the candidate confirmed interest. */
export class TalentSubmissionBlockedError extends TalentError {
  constructor() {
    super(
      'A profile can only be submitted to a client after the candidate has been contacted and has confirmed interest.',
      'TALENT_SUBMISSION_NOT_CONFIRMED',
      409
    );
  }
}

/** A duplicate application for the same candidate and job. */
export class TalentDuplicateApplicationError extends TalentError {
  constructor() {
    super(
      'You have already applied to this position. We will contact you if your profile progresses.',
      'TALENT_DUPLICATE_APPLICATION',
      409
    );
  }
}

/** The résumé failed validation. */
export class TalentInvalidDocumentError extends TalentError {
  constructor(message: string) {
    super(message, 'TALENT_INVALID_DOCUMENT', 400);
  }
}

/** A validation problem that is not already covered by a zod schema. */
export class TalentValidationError extends TalentError {
  constructor(message: string) {
    super(message, 'TALENT_VALIDATION_ERROR', 400);
  }
}

/** The candidate has too many open applications (abuse guard). */
export class TalentApplicationLimitError extends TalentError {
  constructor(message: string) {
    super(message, 'TALENT_APPLICATION_LIMIT_REACHED', 429);
  }
}

/** The provided job is not accepting applications. */
export class TalentJobNotOpenError extends TalentError {
  constructor() {
    super(
      'This position is no longer accepting applications.',
      'TALENT_JOB_NOT_OPEN',
      409
    );
  }
}