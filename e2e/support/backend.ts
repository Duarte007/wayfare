import { randomUUID } from 'node:crypto';
import { BACKEND_URL } from './env.ts';

export type Row = Record<string, unknown>;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  /** A ready session, to skip the sign-in form in tests that are not about it. */
  session: Record<string, unknown>;
}

async function call<T>(path: string, init?: { body?: unknown }): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/__admin/${path}`, {
    method: init?.body === undefined ? 'GET' : 'POST',
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`fake backend ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Test-side handle on the fake backend (see fake-backend/server.ts). */
export const backend = {
  async createUser(name = 'Ana Souza'): Promise<TestUser> {
    // A fresh user per test keeps tests independent: each user sees only their own rows.
    const email = `e2e-${randomUUID()}@example.test`;
    const password = 'correct horse battery staple';
    const { id, session } = await call<{ id: string; session: Record<string, unknown> }>('users', {
      body: { email, password, name },
    });
    return { id, email, password, name, session };
  },

  seed(userId: string, rows: Record<string, Row[]>): Promise<unknown> {
    return call('seed', { body: { userId, rows } });
  },

  /**
   * Drops a row without leaving a deleted copy, as when the user loses access to it: only a full
   * refresh on the device notices.
   */
  forget(userId: string, table: string, id: string): Promise<unknown> {
    return call('forget', { body: { userId, table, id } });
  },

  /** Rows the server holds for a user (deleted ones included). */
  rows(userId: string, table: string): Promise<Row[]> {
    return call(`rows?user=${userId}&table=${table}`);
  },

  /** Files in storage for a user: `<bucket>/<path>`, content type and size. */
  files(userId: string): Promise<{ key: string; type: string; size: number }[]> {
    return call(`files?user=${userId}`);
  },
};
