import type { Metadata } from 'next';
import Link from 'next/link';
import { config } from '@/lib/config';

export function ToolPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-slate-200">{title}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted">{description}</p>
      <div className="mt-10">{children}</div>
    </div>
  );
}

export function toolMetadata(title: string, description: string, path?: string): Metadata {
  const canonical = path ? `${config.APP_URL}${path}` : undefined;
  return {
    title,
    description,
    openGraph: { title, description, url: canonical },
    alternates: { canonical },
  };
}
