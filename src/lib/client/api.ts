'use client';

import { APIResponse } from '@/types/api';

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: 'GET' });
  return parseResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: 'DELETE' });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: APIResponse<T> | null = null;
  try {
    payload = (await response.json()) as APIResponse<T>;
  } catch {
    throw new ApiRequestError('The server returned a malformed response.', response.status);
  }
  if (!payload || typeof payload !== 'object') {
    throw new ApiRequestError('The server returned a malformed response.', response.status);
  }
  if (payload.success === false) {
    if (!payload.error || typeof payload.error.message !== 'string') {
      throw new ApiRequestError('The server returned an invalid error response.', response.status);
    }
    throw new ApiRequestError(payload.error.message, response.status, payload.error.code);
  }
  if (payload.success !== true || !('data' in payload)) {
    throw new ApiRequestError('The server returned a malformed response.', response.status);
  }
  return payload.data;
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) return error.message;
    if (error.status >= 500) return 'The diagnostic service is temporarily unavailable. Please try again.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
