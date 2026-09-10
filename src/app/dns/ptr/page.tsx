import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { PtrTool } from '@/components/tools/ptr-tool';

export const metadata: Metadata = {
  title: 'PTR Lookup',
  description: 'Reverse DNS lookup for public IPv4 and IPv6 addresses. Private and loopback addresses are rejected.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="PTR Lookup"
      description="Look up PTR records for a public IP address. Private, loopback, and link-local addresses are not queried."
    >
      <PtrTool />
    </ToolPage>
  );
}
