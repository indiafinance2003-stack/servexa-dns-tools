import { Finding, FindingSeverity } from '@/types/domain';

export function finding(
  code: string,
  severity: FindingSeverity,
  category: string,
  title: string,
  summary: string,
  explanation: string,
  extras?: { recommendation?: string; evidence?: Record<string, unknown> }
): Finding {
  return {
    code,
    severity,
    category,
    title,
    summary,
    explanation,
    ...(extras?.recommendation ? { recommendation: extras.recommendation } : {}),
    ...(extras?.evidence ? { evidence: extras.evidence } : {}),
  };
}
