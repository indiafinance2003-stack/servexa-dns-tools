import { describe, expect, it } from 'vitest';
import {
  canSubmitToClient,
  canTransitionApplication,
  isConfirmationGateBlocked,
  requiresCandidateConfirmation,
} from '@/lib/talent/policy';

const confirmedAt = new Date('2026-09-20T00:00:00.000Z');

describe('canTransitionApplication — the submission pipeline shape', () => {
  it('walks NEW → CONTACTED → INTERESTED → SHORTLISTED → CLIENT_SUBMITTED', () => {
    expect(canTransitionApplication('NEW', 'CONTACTED')).toBe(true);
    expect(canTransitionApplication('CONTACTED', 'INTERESTED')).toBe(true);
    expect(canTransitionApplication('INTERESTED', 'SHORTLISTED')).toBe(true);
    expect(canTransitionApplication('SHORTLISTED', 'CLIENT_SUBMITTED')).toBe(true);
  });

  it('never submits directly from NEW or from the screening stages', () => {
    expect(canTransitionApplication('NEW', 'CLIENT_SUBMITTED')).toBe(false);
    expect(canTransitionApplication('SCREENING', 'CLIENT_SUBMITTED')).toBe(false);
    expect(canTransitionApplication('CONTACTED', 'CLIENT_SUBMITTED')).toBe(false);
    expect(canTransitionApplication('INTERESTED', 'CLIENT_SUBMITTED')).toBe(false);
  });

  it('rejects unknown or self-transitions', () => {
    expect(canTransitionApplication('NEW', 'NEW')).toBe(false);
    expect(canTransitionApplication('NEW', 'nonsense')).toBe(false);
    expect(canTransitionApplication('nonsense', 'NEW')).toBe(false);
  });
});

describe('canSubmitToClient', () => {
  it('requires both SHORTLISTED and a recorded confirmation', () => {
    expect(canSubmitToClient('SHORTLISTED', true)).toBe(true);
    expect(canSubmitToClient('SHORTLISTED', false)).toBe(false);
    expect(canSubmitToClient('NEW', true)).toBe(false);
    expect(canSubmitToClient('INTERVIEW', true)).toBe(false);
    expect(canSubmitToClient('CLIENT_SUBMITTED', true)).toBe(false);
  });
});

describe('isConfirmationGateBlocked — persisted server-side confirmation', () => {
  it('cannot submit from NEW, even with no confirmation', () => {
    expect(isConfirmationGateBlocked('NEW', 'CLIENT_SUBMITTED', null)).toBe(true);
  });

  it('cannot submit merely because the application is SHORTLISTED', () => {
    // A row that reached SHORTLISTED without ever being confirmed (including
    // pre-migration rows) must not be submittable.
    expect(isConfirmationGateBlocked('SHORTLISTED', 'CLIENT_SUBMITTED', null)).toBe(true);
  });

  it('must confirm before the confirm-gated stages are reachable', () => {
    // SHORTLISTED onward requires the persisted confirmation record.
    expect(isConfirmationGateBlocked('SCREENING', 'SHORTLISTED', null)).toBe(true);
    expect(isConfirmationGateBlocked('CONTACTED', 'SHORTLISTED', null)).toBe(true);
    expect(isConfirmationGateBlocked('INTERESTED', 'SHORTLISTED', null)).toBe(true);
  });

  it('allows reaching INTERESTED itself without prior confirmation', () => {
    // INTERESTED is where the confirmation is recorded, so it is not gated.
    expect(isConfirmationGateBlocked('CONTACTED', 'INTERESTED', null)).toBe(false);
  });

  it('allows submission once confirmation is persisted', () => {
    expect(isConfirmationGateBlocked('SHORTLISTED', 'CLIENT_SUBMITTED', confirmedAt)).toBe(false);
  });

  it('is authoritative regardless of the UI-state shortcut', () => {
    // A SHORTLISTED application with a persisted confirmation is submittable,
    // but the same state without one is blocked — the gate runs server-side.
    expect(isConfirmationGateBlocked('SHORTLISTED', 'CLIENT_SUBMITTED', confirmedAt)).toBe(false);
    expect(isConfirmationGateBlocked('SHORTLISTED', 'CLIENT_SUBMITTED', null)).toBe(true);
  });
});

describe('requiresCandidateConfirmation', () => {
  it('claims the post-confirmation stages', () => {
    expect(requiresCandidateConfirmation('SHORTLISTED')).toBe(true);
    expect(requiresCandidateConfirmation('CLIENT_SUBMITTED')).toBe(true);
    expect(requiresCandidateConfirmation('INTERVIEW')).toBe(true);
    expect(requiresCandidateConfirmation('SELECTED')).toBe(true);
    expect(requiresCandidateConfirmation('OFFER')).toBe(true);
    expect(requiresCandidateConfirmation('JOINED')).toBe(true);
  });

  it('excludes the recruitment stages', () => {
    expect(requiresCandidateConfirmation('NEW')).toBe(false);
    expect(requiresCandidateConfirmation('SCREENING')).toBe(false);
    expect(requiresCandidateConfirmation('CONTACTED')).toBe(false);
    expect(requiresCandidateConfirmation('INTERESTED')).toBe(false);
    expect(requiresCandidateConfirmation('REJECTED')).toBe(false);
  });
});