'use client';

import { useCallback, useState } from 'react';

const CATEGORY_OPTIONS = [
  { value: 'tools', label: 'Diagnostic tools' },
  { value: 'dns', label: 'DNS tools' },
  { value: 'email', label: 'Email tools' },
  { value: 'account', label: 'Account & portal' },
  { value: 'billing', label: 'Billing & subscriptions' },
  { value: 'support', label: 'Support experience' },
  { value: 'other', label: 'Something else' },
];

export function FeedbackForm(): React.ReactElement {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('tools');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch('/api/account/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, category, message }),
        });
        const payload = (await response.json()) as {
          success: boolean;
          error?: { message?: string };
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? 'Feedback could not be sent.');
        }
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Feedback could not be sent.');
      } finally {
        setBusy(false);
      }
    },
    [busy, rating, category, message]
  );

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        <p className="font-medium">Thank you — your feedback has been submitted.</p>
        <p className="mt-1">
          It is recorded on your account and only reviewed by the Ravelyth team.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="text-sm font-medium text-ink">Rating</span>
        <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-checked={rating === value}
              role="radio"
              onClick={() => setRating(value)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm transition-colors ${
                value <= rating
                  ? 'border-accent bg-accent/20 text-accent-soft'
                  : 'border-line text-slate-500 hover:border-accent hover:text-accent'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="feedback-category" className="text-sm font-medium text-ink">
          Category
        </label>
        <select
          id="feedback-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="feedback-message" className="text-sm font-medium text-ink">
          What could be better?
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          maxLength={5000}
          placeholder="Tell us about a tool, a page, or anything you found confusing…"
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || rating === 0 || message.trim().length === 0}
        className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Submitting…' : 'Submit feedback'}
      </button>
      {rating === 0 ? (
        <p className="text-xs text-slate-500">A rating is required before submitting.</p>
      ) : null}
    </form>
  );
}