'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost, formatApiError } from '@/lib/client/api';
import type { DiagnosticContext } from '@/lib/support/context';

const inputClasses =
  'w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent';

interface CreateTicketResponse {
  ticket: {
    id: string;
    reference: string;
    subject: string;
  };
}

export interface SupportRequestFormProps {
  authenticated: boolean;
  initialContext: DiagnosticContext | null;
  initialCategory: string;
  categories: Array<{ value: string; label: string }>;
}

export function SupportRequestForm({
  authenticated,
  initialContext,
  initialCategory,
  categories,
}: SupportRequestFormProps): React.ReactElement {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState(
    initialContext?.findingSummary ? `Observed finding: ${initialContext.findingSummary}\n\n` : ''
  );
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState('normal');
  const [affectedDomain, setAffectedDomain] = useState(initialContext?.domain ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // The sanitized diagnostic context travels with the request verbatim; the
  // server re-validates and re-sanitizes it, so this is a convenience only.
  const contextPayload = useMemo(() => {
    if (!initialContext) return undefined;
    const entries = Object.entries(initialContext).filter(([, value]) => value !== null);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries) as Record<string, unknown>;
  }, [initialContext]);

  const domainSuggestion = initialContext?.domain ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsAuth(false);

    if (!authenticated) {
      setNeedsAuth(true);
      setError(
        'Support requests are linked to a free Ravelyth account so you can track replies in your portal. Sign in or create an account first — your message is kept below.'
      );
      return;
    }
    if (subject.trim().length < 4) {
      setError('Give your request a short subject (at least 4 characters).');
      return;
    }
    if (description.trim().length < 15) {
      setError('Describe the problem in at least 15 characters so the request is actionable.');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      };
      const domain = affectedDomain.trim();
      if (domain.length > 0) payload.affectedDomain = domain;
      if (contextPayload) payload.context = contextPayload;

      const result = await apiPost<CreateTicketResponse>('/api/support/tickets', payload);
      router.push(`/account/support/${result.ticket.id}`);
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  }

  return <form onSubmit={onSubmit} className="space-y-4" noValidate>{renderBody()}</form>;

  function renderBody(): React.ReactNode {
    return (
      <>
        {!authenticated ? (
          <p className="rounded-md bg-sky-500/10 p-3 text-sm text-sky-300">
            Support requests are tracked in your Ravelyth account.{' '}
            <Link href="/login" className="font-medium underline hover:text-sky-300">
              Sign in
            </Link>{' '}
            or{' '}
            <Link href="/register" className="font-medium underline hover:text-sky-300">
              create a free account
            </Link>{' '}
            to submit — creating an account is free and all diagnostic tools stay free.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
            {error}
            {needsAuth ? (
              <>
                {' '}
                <Link href="/login" className="font-medium underline">
                  Sign in
                </Link>{' '}
                or{' '}
                <Link href="/register" className="font-medium underline">
                  create an account
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClasses}
            placeholder="Short summary, e.g. Mail to info@ is bouncing since Monday"
            maxLength={140}
            required
            disabled={loading}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Area</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClasses}
              disabled={loading}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Urgency</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputClasses}
              disabled={loading}
            >
              <option value="low">Low — planning / question</option>
              <option value="normal">Normal — affecting one function</option>
              <option value="high">High — site down, mail down, security</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Affected domain (optional)</span>
          <input
            type="text"
            value={affectedDomain}
            onChange={(e) => setAffectedDomain(e.target.value)}
            className={inputClasses}
            placeholder="example.com"
            maxLength={253}
            autoCapitalize="none"
            spellCheck={false}
            disabled={loading}
          />
          <span className="mt-1 block text-xs text-slate-400">
            {domainSuggestion
              ? 'Pre-filled from the diagnostic you came from — correct it if needed.'
              : 'The domain or hostname this request is about, if any.'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">What is happening?</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClasses} min-h-32`}
            placeholder="Describe the problem, what you expected, when it started, and any error messages."
            maxLength={5000}
            required
            rows={6}
            disabled={loading}
          />
          <span className="mt-1 block text-xs text-slate-400">
            {description.length}/5000 characters. Never paste passwords or private keys.
          </span>
        </label>

        {contextPayload ? (
          <fieldset className="rounded-md border border-line bg-paper p-3 text-xs text-slate-400">
            <legend className="px-1 font-medium text-slate-300">Attached diagnostic context</legend>
            <ul className="list-disc space-y-0.5 pl-4">
              {contextPayload.tool ? <li>Tool: {String(contextPayload.tool).replace(/_/g, ' ')}</li> : null}
              {contextPayload.domain ? <li>Domain: {String(contextPayload.domain)}</li> : null}
              {contextPayload.findingCounts ? (
                <li>
                  Findings: {String((contextPayload.findingCounts as Record<string, number>).error)} error /{' '}
                  {String((contextPayload.findingCounts as Record<string, number>).warning)} warning /{' '}
                  {String((contextPayload.findingCounts as Record<string, number>).info)} info
                </li>
              ) : null}
              {contextPayload.diagnosticReference ? (
                <li>Run reference: {String(contextPayload.diagnosticReference)}</li>
              ) : null}
            </ul>
          </fieldset>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
        >
          {loading ? 'Submitting…' : authenticated ? 'Submit request' : 'Sign in to submit'}
        </button>

        {!authenticated ? (
          <p className="text-xs text-slate-400">
            The form becomes active once you sign in — requests must belong to an account so you can
            receive replies and track status. Ravelyth never asks for your password on this page.
          </p>
        ) : null}
      </>
    );
  }
}
