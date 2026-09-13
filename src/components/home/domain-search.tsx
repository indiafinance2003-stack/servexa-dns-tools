'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function DomainSearch({
  action = '/dns/analyze',
  label = 'Analyze',
  size = 'md',
}: {
  action?: string;
  label?: string;
  size?: 'md' | 'lg';
}): React.ReactElement {
  const router = useRouter();
  const [value, setValue] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const domain = value.trim();
    if (!domain) return;
    router.push(`${action}?domain=${encodeURIComponent(domain)}`);
  }

  const inputClasses =
    size === 'lg'
      ? 'h-12 flex-1 rounded-md border border-line bg-white px-4 text-base text-ink placeholder:text-slate-400 focus:border-accent'
      : 'h-10 flex-1 rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-accent';
  const buttonClasses =
    size === 'lg'
      ? 'h-12 shrink-0 rounded-md bg-accent px-6 text-base font-medium text-white hover:bg-accent-strong'
      : 'h-10 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-strong';

  return (
    <form onSubmit={onSubmit} role="search" className="flex w-full gap-2">
      <label htmlFor="domain-search" className="sr-only">
        Domain name
      </label>
      <input
        id="domain-search"
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="example.com"
        className={inputClasses}
      />
      <button type="submit" className={buttonClasses}>
        {label}
      </button>
    </form>
  );
}