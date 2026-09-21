import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password | Ravelyth',
  description: 'Choose a new password for your Ravelyth account.',
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const token = params.token && params.token.length > 0 ? params.token : null;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Reset password</h1>
      <p className="mt-2 text-sm text-muted">Choose a new password for your Ravelyth account.</p>
      <div className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <p className="text-center text-sm text-slate-400">
              <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-strong">
                Request a new reset link
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
