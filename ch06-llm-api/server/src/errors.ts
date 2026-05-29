export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    public readonly cause: unknown,
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`${service}: ${message}`);
    this.name = 'ExternalServiceError';
  }
}
