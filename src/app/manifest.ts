import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ravelyth',
    short_name: 'Ravelyth',
    description:
      'Free DNS and email diagnostic tools for DNS lookup, SPF, DKIM, DMARC, nameservers, DNS health, PTR records and email header analysis.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}