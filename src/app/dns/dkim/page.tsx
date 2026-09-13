import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'DKIM Checker',
  description: 'Look up a DKIM selector and inspect the published public key. Cryptographic signature verification is not performed.',
  alternates: {
    canonical: '/dns/dkim',
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
      title="DKIM Checker"
      description="Enter a domain and selector (from a DKIM-Signature s= tag). Signature present on mail is separate; cryptographic verification not performed."
    >
      <DomainAnalyzeTool
        endpoint="/api/dns/dkim"
        initialDomain={params.domain}
        initialSelector={params.selector}
        extraFields={[{ name: 'selector', label: 'Selector', placeholder: 'default' }]}
      />
    </ToolPage>
  );
}
