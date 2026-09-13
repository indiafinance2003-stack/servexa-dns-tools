import type { Metadata } from 'next';
import { ToolPage } from '@/components/layout/tool-page';
import { DomainAnalyzeTool } from '@/components/tools/domain-analyze-tool';
import { parseToolSearchParams } from '@/lib/client/tool-params';

export const metadata: Metadata = {
  title: 'SPF Checker',
  description: 'Parse a domain SPF record and review common configuration issues. No sender-IP authorization test unless an IP is supplied.',
  alternates: {
    canonical: '/dns/spf',
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
      title="SPF Checker"
      description="Locate and parse v=spf1 TXT records. This is a policy review, not a live check of whether a particular IP is authorized to send."
    >
      <DomainAnalyzeTool endpoint="/api/dns/spf" initialDomain={params.domain} />
    </ToolPage>
  );
}
