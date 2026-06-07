// #book ch03-api-types
// ch03-server-patterns/shared/src/api.ts

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Response builder
export function apiResponse<T>(
  data: T,
  meta?: ApiResponse<T>['meta'],
): ApiResponse<T> {
  return meta !== undefined ? { data, meta } : { data };
}
// #endbook
