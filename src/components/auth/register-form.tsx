'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost, formatApiError } from '@/lib/client/api';

const inputClasses =
  'w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent';

export function RegisterForm(): React.ReactElement {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/auth/register', { name, email, password, confirmPassword });
      router.push('/account');
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClasses}
          placeholder="Your name"
          required
          maxLength={80}
          autoComplete="name"
          disabled={loading}
        />
      </label>
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
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Password</span>
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
        <span className="mb-1 block text-sm font-medium text-ink">Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClasses}
          placeholder="Repeat your password"
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
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-strong">
          Sign in
        </Link>
        . Accounts are optional — all public tools work without one.
      </p>
    </form>
  );
}
