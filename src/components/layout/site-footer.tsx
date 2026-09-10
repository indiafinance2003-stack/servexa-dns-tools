import Link from 'next/link';

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Ravelyth Tools — public DNS and email diagnostics.</p>
        <div className="flex gap-4">
          <Link href="/about" className="hover:text-teal-800">
            About
          </Link>
          <Link href="/docs" className="hover:text-teal-800">
            Documentation
          </Link>
        </div>
      </div>
    </footer>
  );
}
