import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { HealthResponse } from '@/types/api';

export function GET(): NextResponse<{ success: true; data: HealthResponse }> {
  return NextResponse.json(
    {
      success: true,
      data: {
        service: 'Ravelyth Tools',
        status: 'operational',
        version: config.APP_VERSION,
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
