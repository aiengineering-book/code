export class RateLimitError extends Error {
  public retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
