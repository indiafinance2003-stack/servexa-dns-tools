import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';

export const metadata: Metadata = {
  title: 'DMARC Checker',
  description: 'Inspect the published DMARC policy at _dmarc.domain, including tags such as p, sp, pct, rua, and alignment.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="DMARC Checker"
      description="Read the published DMARC policy. This does not authenticate a specific message."
    >
      <DomainAnalyzeTool endpoint="/api/dns/dmarc" />
    </ToolPage>
  );
}
