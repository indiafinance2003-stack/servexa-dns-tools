import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Ravelyth account.',
  robots: { index: false, follow: false },
};

export default async function LoginPage(): Promise<React.ReactElement> {
  // Already signed in visitors go straight to their account.
  if (await getSessionUser()) {
    redirect('/account');
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to save DNS analyses to your account. Public tools remain available without signing in.
      </p>
      <div className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <LoginForm />
      </div>
    </div>
  );
}
