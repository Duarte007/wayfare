import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  AiUnavailableError,
  NotFoundError,
  PlaceSearchUnavailableError,
  QuotaExceededError,
} from '../../application/errors.js';

/** Maps application errors to HTTP; anything unexpected becomes a generic 500. */
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
  if (err instanceof QuotaExceededError) return c.json({ error: err.message }, 429);
  if (err instanceof AiUnavailableError) {
    console.error(err, { cause: err.cause });
    return c.json({ error: 'AI is unavailable, try again later' }, 503);
  }
  if (err instanceof PlaceSearchUnavailableError) {
    console.error(err);
    return c.json({ error: 'Place search is unavailable, try again later' }, 503);
  }
  console.error(err);
  return c.json({ error: 'Internal error' }, 500);
};
