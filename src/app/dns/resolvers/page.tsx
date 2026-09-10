import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { ResolverTool } from '@/components/tools/resolver-tool';

export const metadata: Metadata = {
  title: 'Resolver Comparison',
  description: 'Compare DNS answers from selected public resolvers. This is not a global propagation measurement.',
};

export default function Page(): React.ReactElement {
  return (
    <ToolPage
      title="Resolver comparison"
      description="Observed responses from selected public resolvers (Cloudflare, Google, Quad9, and OpenDNS). This is not worldwide DNS propagation."
    >
      <ResolverTool />
    </ToolPage>
  );
}
