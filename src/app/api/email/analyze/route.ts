import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { emailAnalyzeSchema } from '@/lib/validation/schemas';
import { analyzeEmailHeaders } from '@/lib/email/analysis/email-analyzer';
import { config } from '@/lib/config';
import { RequestTooLargeError } from '@/lib/errors/app-error';

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const body = await readJsonBody(req);
    const validated = parseWithSchema(emailAnalyzeSchema, body);
    if (Buffer.byteLength(validated.headers, 'utf8') > config.MAX_EMAIL_HEADER_BYTES) {
      throw new RequestTooLargeError(
        `Email headers exceed maximum size of ${config.MAX_EMAIL_HEADER_BYTES} bytes`,
        config.MAX_EMAIL_HEADER_BYTES
      );
    }
    return analyzeEmailHeaders(validated.headers);
  });
}
