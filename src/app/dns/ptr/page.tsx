import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { PtrTool } from '@/components/tools/ptr-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'PTR Lookup',
  description: 'Reverse DNS lookup for public IPv4 and IPv6 addresses. Private and loopback addresses are rejected.',
  alternates: {
    canonical: '/dns/ptr',
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const params = parseToolSearchParams(await searchParams);
  return (
    <ToolPage
      title="PTR Lookup"
      description="Look up PTR records for a public IP address. Private, loopback, and link-local addresses are not queried."
    >
      <PtrTool initialIp={params.ip} />
    </ToolPage>
  );
}
