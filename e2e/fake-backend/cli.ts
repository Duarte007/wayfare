/** Runs the fake backend on its own: `pnpm --filter @wayfare/e2e fake-backend`. */
import { FAKE_BACKEND_PORT } from '../support/env.ts';
import { startFakeBackend } from './server.ts';

const port = Number(process.env.FAKE_BACKEND_PORT ?? FAKE_BACKEND_PORT);
await startFakeBackend(port);
console.log(`[fake-backend] listening on http://localhost:${port}`);
