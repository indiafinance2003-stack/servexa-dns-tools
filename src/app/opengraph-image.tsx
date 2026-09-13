import { ImageResponse } from 'next/og';

export const alt = 'Ravelyth — DNS and email diagnostics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '72px 76px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 18,
              backgroundColor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 56, height: 56, display: 'flex' }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, border: '4px solid #14b8a6' }} />
              <div style={{ position: 'absolute', top: 27, left: 0, width: 56, height: 2, backgroundColor: '#0d9488' }} />
              <div style={{ position: 'absolute', top: 0, left: 27, width: 2, height: 56, backgroundColor: '#0d9488' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 23,
                  left: 23,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#a7f3e8',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: 24 }}>
            <div style={{ fontSize: 52, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>Ravelyth</div>
            <div style={{ fontSize: 26, color: '#0f766e', marginTop: 8 }}>Free DNS and email diagnostics</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            fontSize: 54,
            fontWeight: 700,
            color: '#0f172a',
            marginTop: 44,
            lineHeight: 1.15,
          }}
        >
          <div>DNS &amp; Email Diagnostics,</div>
          <div>Made Clear.</div>
        </div>
        <div style={{ fontSize: 28, color: '#475569', marginTop: 20 }}>
          Inspect DNS records, nameservers, SPF, DKIM, DMARC, DNSSEC-related data and raw email headers.
        </div>
        <div style={{ fontSize: 22, color: '#115e59', marginTop: 28 }}>
          ravelyth.in · No account required · No simulated results
        </div>
      </div>
    ),
    size
  );
}