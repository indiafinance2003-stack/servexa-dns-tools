import { z } from 'zod';
import { DNSRecordType } from '@/types/domain';

export const domainQuerySchema = z.object({
  domain: z.string().min(1).max(253),
});

export const dnsLookupSchema = z.object({
  domain: z.string().min(1).max(253),
  recordType: z.nativeEnum(DNSRecordType),
});

export const dkimQuerySchema = z.object({
  domain: z.string().min(1).max(253),
  selector: z.string().min(1).max(63),
});

export const ptrQuerySchema = z.object({
  ip: z.string().min(1).max(128).optional(),
  hostname: z.string().min(1).max(128).optional(),
}).refine((value) => Boolean(value.ip || value.hostname), {
  message: 'An IP address is required',
});

export const resolverComparisonSchema = z.object({
  domain: z.string().min(1).max(253),
  recordType: z.nativeEnum(DNSRecordType).default(DNSRecordType.A),
});

export const emailAnalyzeSchema = z.object({
  headers: z.string().min(1),
});
