import Link from 'next/link';

export function InfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {intro ? <p className="mt-3 text-lg text-muted">{intro}</p> : null}
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}

export function InfoSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={id} className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-700">{children}</div>
    </section>
  );
}

export function InfoLinkList({
  items,
}: {
  items: Array<{ label: string; href: string; note?: string }>;
}): React.ReactElement {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="font-medium text-accent hover:text-accent-strong">
            {item.label}
          </Link>
          {item.note ? <p className="mt-0.5 text-sm text-slate-600">{item.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}