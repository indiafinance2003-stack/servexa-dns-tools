import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';

export const metadata: Metadata = {
  title: 'SPF Checker',
  description: 'Parse a domain SPF record and review common configuration issues. No sender-IP authorization test unless an IP is supplied.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="SPF Checker"
      description="Locate and parse v=spf1 TXT records. This is a policy review, not a live check of whether a particular IP is authorized to send."
    >
      <DomainAnalyzeTool endpoint="/api/dns/spf" />
    </ToolPage>
  );
}
