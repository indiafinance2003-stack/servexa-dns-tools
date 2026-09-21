import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password | Ravelyth',
  description: 'Request a password reset link for your Ravelyth account.',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage(): Promise<React.ReactElement> {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Forgot password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the email address linked to your account and we will send you a link to reset your
        password.
      </p>
      <div className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}