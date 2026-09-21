import Link from 'next/link';
import { requireOwner } from '@/lib/admin/guards';
import { listAllContactSubmissions } from '@/lib/contact/service';
import { ContactTriage } from '@/components/contact/contact-triage';

export const metadata = {
  title: 'Contact submissions',
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );
}

export default async function OwnerContactPage() {
  await requireOwner();
  const items = await listAllContactSubmissions({});

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Contact submission</h1>
        <Link href="/owner" className="text-sm font-medium text-accent hover:text-accent-strong">
          Back to Owner Room
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Public contact form responses. IP addresses are stored only as SHA-256 fingerprints for
        spam review.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">No contact submissions yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-navy-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {item.name} <span className="text-slate-500">·</span>{' '}
                    <span className="font-mono text-xs text-slate-400">{item.email}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.subject} · {formatDate(item.createdAt)}
                  </p>
                  {item.ipFingerprint ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                      ip sha256:{item.ipFingerprint.slice(0, 16)}…
                    </p>
                  ) : null}
                </div>
                <ContactTriage submissionId={item.id} currentStatus={item.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
              {item.status !== 'new' ? (
                <p className="mt-2 text-xs text-slate-500">Last updated {formatDate(item.updatedAt)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}