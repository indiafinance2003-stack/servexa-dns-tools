import Link from 'next/link';

export const metadata = {
  title: 'Owner Room',
  robots: { index: false, follow: false },
};

/**
 * Owner Room overview — a navigation hub into the operational areas.
 * Every linked page is real; sections that do not exist yet are not linked.
 */
export default function OwnerOverviewPage() {
  const areas = [
    {
      href: '/owner/talent',
      title: 'Talent',
      body: 'Recruitment pipeline: jobs, candidates, applications, interviews, placements, and fees.',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Owner Room</h1>
      <p className="mt-2 text-sm text-muted">
        Private operational area. Every page and API here is authorized server-side.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="flex flex-col rounded-xl border border-line bg-white p-5 transition hover:border-accent hover:shadow-sm"
          >
            <h2 className="text-base font-semibold text-ink">{area.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{area.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
