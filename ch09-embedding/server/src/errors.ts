// #book-ref ch08-conversation/server/src/errors.ts
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ExternalServiceError extends Error {
  constructor(service: string, cause?: unknown) {
    super(`External service error: ${service}`);
    this.name = 'ExternalServiceError';
    if (cause instanceof Error) this.cause = cause;
  }
}
