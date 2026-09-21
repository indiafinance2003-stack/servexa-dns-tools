'use client';

import { useCallback, useState } from 'react';

export function ContactForm(): React.ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
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
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, subject, message, website }),
        });
        const payload = (await response.json()) as {
          success: boolean;
          error?: { message?: string };
        };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message ?? 'Your message could not be sent.');
        }
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Your message could not be sent.');
      } finally {
        setBusy(false);
      }
    },
    [busy, name, email, subject, message, website]
  );

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        <p className="font-medium">Message received.</p>
        <p className="mt-1">Thank you — we aim to follow up at the email address you provided.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      {/* Honeypot: visually hidden, ignored by humans, a trap for bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          maxLength={100}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          maxLength={254}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="contact-subject" className="text-sm font-medium text-ink">
          Subject
        </label>
        <input
          id="contact-subject"
          type="text"
          value={subject}
          maxLength={200}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="contact-message" className="text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          rows={6}
          maxLength={8000}
          onChange={(event) => setMessage(event.target.value)}
          className="mt-2 block w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300 sm:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}