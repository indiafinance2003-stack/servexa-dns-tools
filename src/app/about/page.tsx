import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Ravelyth Tools, a free public DNS and email diagnostics toolkit.',
};

export default function Page(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">About</h1>
      <p className="mt-4 text-slate-700">
        Ravelyth Tools is a free public website for DNS lookups and email header diagnostics. It is intended for
        operators, developers, and anyone investigating mail delivery or domain configuration.
      </p>
      <p className="mt-4 text-slate-700">
        The application is stateless: each request is evaluated independently. Rate limits apply to reduce abuse. Lookups
        use public DNS resolution APIs rather than shell commands, and private network targets are rejected.
      </p>
    </div>
  );
}
