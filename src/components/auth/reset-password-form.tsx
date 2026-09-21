'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiPost, formatApiError } from '@/lib/client/api';

const inputClasses =
  'w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps): React.ReactElement {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // The raw token travels only in this HTTPS POST body.
      await apiPost<{ message: string }>('/api/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setCompleted(true);
      setLoading(false);
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Your password has been reset. Please sign in with your new password.
        </p>
        <p className="text-center text-sm text-slate-400">
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
        <span className="mb-1 block text-sm font-medium text-ink">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClasses}
          placeholder="At least 10 characters"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
          disabled={loading}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClasses}
          placeholder="Repeat your new password"
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? 'Resetting…' : 'Reset password'}
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
