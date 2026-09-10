import type { Metadata } from 'next';

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function toolMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: undefined },
  };
}
