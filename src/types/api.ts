export interface APISuccess<T> {
  success: true;
  data: T;
}

export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type APIResponse<T> = APISuccess<T> | APIError;

export interface HealthResponse {
  service: string;
  status: string;
  version: string;
  environment: string;
  timestamp: string;
}
