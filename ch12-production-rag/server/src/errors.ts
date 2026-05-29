// #book-ref ch11-rag/server/src/errors.ts
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ExternalServiceError extends Error {
  constructor(service: string, cause?: unknown) {
    super(`External service error: ${service}`);
    this.name = 'ExternalServiceError';
    if (cause instanceof Error) this.cause = cause;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = '无权访问') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
