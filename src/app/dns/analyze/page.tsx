import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'DNS Health',
  description: 'Inspect DNS records, nameservers, SPF, DMARC, and DNSSEC-related records for a domain.',
  alternates: {
    canonical: '/dns/analyze',
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
      title="DNS Health"
      description="Run a structured inspection of published DNS data. Findings are labeled Pass, Info, Warning, or Error based on evidence from this resolver. No unexplained score is assigned."
    >
      <DomainAnalyzeTool endpoint="/api/dns/analyze" initialDomain={params.domain} />
    </ToolPage>
  );
}
