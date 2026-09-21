'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost, formatApiError } from '@/lib/client/api';

const inputClasses =
  'w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent';

export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost('/api/auth/login', { email, password });
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
          placeholder="Your password"
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-slate-400">
        No account yet?{' '}
        <Link href="/register" className="font-medium text-accent hover:text-accent-strong">
          Create one
        </Link>
        . Accounts are optional — all public tools work without one.
      </p>
    </form>
  );
}
