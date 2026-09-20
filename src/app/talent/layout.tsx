import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Ravelyth Talent — Technology Recruitment & Talent Sourcing',
    template: '%s | Ravelyth Talent',
  },
  description:
    'Ravelyth Talent sources, screens, and coordinates technology talent — technical support, NOC, Linux, QA, and more — for IT services, SaaS, hosting, and product companies.',
  alternates: { canonical: '/talent' },
};

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
