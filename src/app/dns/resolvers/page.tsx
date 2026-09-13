import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { ResolverTool } from '@/components/tools/resolver-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'Resolver Comparison',
  description: 'Compare DNS answers from selected public resolvers. This is not a global propagation measurement.',
  alternates: {
    canonical: '/dns/resolvers',
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
      title="Resolver comparison"
      description="Observed responses from selected public resolvers (Cloudflare, Google, Quad9, and OpenDNS). This is not worldwide DNS propagation."
    >
      <ResolverTool initialDomain={params.domain} initialRecordType={params.recordType} />
    </ToolPage>
  );
}
