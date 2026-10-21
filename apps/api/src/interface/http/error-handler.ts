import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AiUnavailableError, QuotaExceededError } from '../../application/errors.js';

/** Maps application errors to HTTP; anything unexpected becomes a generic 500. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err instanceof QuotaExceededError) return c.json({ error: err.message }, 429);
  if (err instanceof AiUnavailableError)
    return c.json({ error: 'AI is unavailable, try again later' }, 503);
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
};
