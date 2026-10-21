/** Ports and URLs shared by the Playwright config, the fake backend and the tests. */
export const APP_PORT = 5188;
export const FAKE_BACKEND_PORT = 54329;
export const APP_URL = `http://localhost:${APP_PORT}`;
export const BACKEND_URL = `http://localhost:${FAKE_BACKEND_PORT}`;
/** Any non-empty value works: the fake backend ignores the API key. */
export const ANON_KEY = 'fake-anon-key';
/** supabase-js keeps the session under `sb-<first label of the host>-auth-token`. */
export const AUTH_STORAGE_KEY = `sb-${new URL(BACKEND_URL).hostname.split('.')[0]}-auth-token`;
