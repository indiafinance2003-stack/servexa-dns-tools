'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiPost, formatApiError } from '@/lib/client/api';

const inputClasses =
  'w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent';

const SUCCESS_MESSAGE = 'If an account exists for that email, a password reset link will be sent.';

export function ForgotPasswordForm(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSubmitted(false);
    try {
      await apiPost<{ message: string }>('/api/auth/forgot-password', { email });
      setSubmitted(true);
      setLoading(false);
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {SUCCESS_MESSAGE}
        </p>
        <p className="text-center text-sm text-slate-400">
          Remembered your password?{' '}
          <Link href="/login" className="font-medium text-accent hover:text-accent-strong">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@example.com"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-slate-400">
        Remembered your password?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </form>
  );
}