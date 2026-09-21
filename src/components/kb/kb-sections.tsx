import Link from 'next/link';
import type { KbSection } from '@/lib/kb/content';

/**
 * Renders a structured KB section. Bodies are stored as typed JSON, never as
 * HTML — there is no HTML parsing and no dangerouslySetInnerHTML on this path,
 * so stored content cannot inject markup into the public site.
 */
export function KbSectionView({ section }: { section: KbSection }): React.ReactElement {
  return (
    <section className="rounded-xl border border-line bg-navy-surface p-6">
      <h2 className="text-xl font-semibold text-ink">{section.heading}</h2>
      <div className="mt-3 space-y-3 text-slate-300">
        {section.kind === 'text'
          ? section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          : null}
        {section.kind === 'list' ? (
          <ul className={`space-y-2 pl-5 ${section.ordered ? 'list-decimal' : 'list-disc'}`}>
            {section.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : null}
        {section.kind === 'steps' ? (
          <ol className="space-y-3">
            {section.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent-soft">
                  {index + 1}
                </span>
                <span>
                  <span className="font-medium text-ink">{step.title}</span>{' '}
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        {section.kind === 'code' ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
            <code>{section.lines.join('\n')}</code>
          </pre>
        ) : null}
      </div>
    </section>
  );
}

export function KbArticleLinks({
  relatedTools,
  relatedArticles,
}: {
  relatedTools: Array<{ label: string; href: string }>;
  relatedArticles: Array<{ slug: string; title: string }>;
}): React.ReactElement {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {relatedTools.length > 0 ? (
        <section className="rounded-xl border border-line bg-navy-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Diagnose it yourself</h2>
          <ul className="mt-3 space-y-2">
            {relatedTools.map((tool) => (
              <li key={tool.href}>
                <Link href={tool.href} className="font-medium text-accent hover:text-accent-strong">
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {relatedArticles.length > 0 ? (
        <section className="rounded-xl border border-line bg-navy-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Related guides</h2>
          <ul className="mt-3 space-y-2">
            {relatedArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/docs/${article.slug}`}
                  className="font-medium text-accent hover:text-accent-strong"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}