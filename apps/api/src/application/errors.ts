/** Application errors; the HTTP layer maps them to status codes. */
export class QuotaExceededError extends Error {
  constructor() {
    super('Daily AI limit reached');
    this.name = 'QuotaExceededError';
  }
}

export class AiUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiUnavailableError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
