import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DnsLookupTool } from '@/components/tools/dns-lookup-tool';

export const metadata: Metadata = {
  title: 'DNS Lookup',
  description: 'Look up public DNS records including A, AAAA, MX, NS, TXT, SOA, SRV, CAA, CNAME, and PTR.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="DNS Lookup"
      description="Query a public domain name for a selected record type. Results come from this application's resolver, not from simulated data."
    >
      <DnsLookupTool />
    </ToolPage>
  );
}
