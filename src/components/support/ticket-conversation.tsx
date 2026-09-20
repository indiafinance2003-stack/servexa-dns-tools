'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, formatApiError } from '@/lib/client/api';

export interface ConversationMessage {
  id: string;
  authorLabel: string;
  body: string;
  createdAt: string;
}

interface TicketConversationProps {
  ticketId: string;
  messages: ConversationMessage[];
  canReply: boolean;
  canClose: boolean;
  canReopen: boolean;
  canConfirmResolution: boolean;
}

function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function TicketConversation({
  ticketId,
  messages,
  canReply,
  canClose,
  canReopen,
  canConfirmResolution,
}: TicketConversationProps): React.ReactElement {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  async function onReply(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (reply.trim().length === 0) {
      setError('Write a message before sending.');
      return;
    }
    setBusy('reply');
    try {
      await apiPost(`/api/support/tickets/${ticketId}/messages`, { body: reply.trim() });
      setReply('');
      setConfirmed('Your reply was added to the ticket.');
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action: 'close' | 'confirm_resolution' | 'reopen') {
    setError(null);
    setBusy(action);
    try {
      await apiPost(`/api/support/tickets/${ticketId}/actions`, { action });
      setConfirmed(
        action === 'close'
          ? 'The ticket was closed.'
          : action === 'confirm_resolution'
            ? 'Thanks — the resolution was confirmed and the ticket is closed.'
            : 'The ticket was reopened and returned to the support queue.'
      );
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(null);
    }
  }

  return <div className="mt-4">{renderConversation()}</div>;

  function renderConversation(): React.ReactNode {
    return (
      <>
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversation</h2>
          {messages.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No messages yet.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className="rounded-lg border border-line bg-paper p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{message.authorLabel}</p>
                    <p className="text-xs text-slate-500">{formatMessageTime(message.createdAt)} UTC</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{message.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-line bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Actions</h2>

          {confirmed ? (
            <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              {confirmed}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {canReply ? (
            <form onSubmit={onReply} className="mt-4 space-y-3" noValidate>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Add a reply</span>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent"
                  placeholder="Add details, answers to questions, or results of suggested steps…"
                  maxLength={5000}
                  rows={4}
                  disabled={busy !== null}
                />
                <span className="mt-1 block text-xs text-slate-500">{reply.length}/5000 characters</span>
              </label>
              <button
                type="submit"
                disabled={busy !== null}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
              >
                {busy === 'reply' ? 'Sending…' : 'Send reply'}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Replying is disabled while the ticket is resolved or closed. Reopen it to continue the
              conversation.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {canClose ? (
              <button
                type="button"
                onClick={() => runAction('close')}
                disabled={busy !== null}
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700 disabled:opacity-60"
              >
                {busy === 'close' ? 'Closing…' : 'Close ticket'}
              </button>
            ) : null}
            {canConfirmResolution ? (
              <button
                type="button"
                onClick={() => runAction('confirm_resolution')}
                disabled={busy !== null}
                className="rounded-md border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              >
                {busy === 'confirm_resolution' ? 'Confirming…' : 'Confirm resolution'}
              </button>
            ) : null}
            {canReopen ? (
              <button
                type="button"
                onClick={() => runAction('reopen')}
                disabled={busy !== null}
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {busy === 'reopen' ? 'Reopening…' : 'Reopen ticket'}
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Closing or confirming stops the work; reopening returns the ticket to the support queue with
            its full history. Every action is recorded in the ticket timeline.
          </p>
        </section>
      </>
    );
  }
}
