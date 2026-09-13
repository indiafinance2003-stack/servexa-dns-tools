import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'DMARC Checker',
  description: 'Inspect the published DMARC policy at _dmarc.domain, including tags such as p, sp, pct, rua, and alignment.',
  alternates: {
    canonical: '/dns/dmarc',
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
      title="DMARC Checker"
      description="Read the published DMARC policy. This does not authenticate a specific message."
    >
      <DomainAnalyzeTool endpoint="/api/dns/dmarc" initialDomain={params.domain} />
    </ToolPage>
  );
}
