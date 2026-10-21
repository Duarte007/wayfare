import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { AuthenticatedUser } from '../../../infrastructure/supabase/user-client.js';

export type Authenticate = (accessToken: string) => Promise<AuthenticatedUser | null>;
export type UserVariables = { auth: AuthenticatedUser };

export function requireUser(authenticate: Authenticate) {
  return createMiddleware<{ Variables: UserVariables }>(async (c, next) => {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HTTPException(401, { message: 'Missing bearer token' });
    const auth = await authenticate(token);
    if (!auth) throw new HTTPException(401, { message: 'Invalid or expired session' });
    c.set('auth', auth);
    await next();
  });
}
