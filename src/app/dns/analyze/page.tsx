import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';

export const metadata: Metadata = {
  title: 'DNS Health',
  description: 'Inspect DNS records, nameservers, SPF, DMARC, and DNSSEC-related records for a domain.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="DNS Health"
      description="Run a structured inspection of published DNS data. Findings are labeled Pass, Info, Warning, or Error based on evidence from this resolver. No unexplained score is assigned."
    >
      <DomainAnalyzeTool endpoint="/api/dns/analyze" />
    </ToolPage>
  );
}
