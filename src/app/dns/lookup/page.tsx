import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DnsLookupTool } from '@/components/tools/dns-lookup-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';
import { getSessionUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'DNS Lookup',
  description: 'Look up public DNS records including A, AAAA, MX, NS, TXT, SOA, SRV, CAA, CNAME, and PTR.',
  alternates: {
    canonical: '/dns/lookup',
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = parseToolSearchParams(await searchParams);
  // Account features are optional: anonymous visitors still get the full tool.
  let canSave = false;
  try {
    canSave = Boolean(await getSessionUser());
  } catch {
    canSave = false;
  }

  return (
    <ToolPage
      title="DNS Lookup"
      description="Query a public domain name for a selected record type. Results come from this application's resolver, not from simulated data."
    >
      <DnsLookupTool
        initialDomain={params.domain}
        initialRecordType={params.recordType}
        canSave={canSave}
      />
    </ToolPage>
  );
}
