import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';

export const metadata: Metadata = {
  title: 'DKIM Checker',
  description: 'Look up a DKIM selector and inspect the published public key. Cryptographic signature verification is not performed.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="DKIM Checker"
      description="Enter a domain and selector (from a DKIM-Signature s= tag). Signature present on mail is separate; cryptographic verification not performed."
    >
      <DomainAnalyzeTool
        endpoint="/api/dns/dkim"
        extraFields={[{ name: 'selector', label: 'Selector', placeholder: 'default' }]}
      />
    </ToolPage>
  );
}
