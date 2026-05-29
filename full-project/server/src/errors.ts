export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  public retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(
      429,
      `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
    );
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
