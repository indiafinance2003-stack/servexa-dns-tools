import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { EmailAnalyzerTool } from '@/components/tools/email-analyzer-tool';

export const metadata: Metadata = {
  title: 'Email Header Analyzer',
  description: 'Paste complete raw email headers to inspect Received hops, authentication results, and domain relationships.',
  alternates: {
    canonical: '/email/analyze',
  },
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="Email Header Analyzer"
      description="Paste the complete raw header block. Folded and repeated headers are supported. This tool reports what headers say; it does not independently authenticate the message."
    >
      <EmailAnalyzerTool />
    </ToolPage>
  );
}
