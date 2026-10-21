/**
 * A small in-memory stand-in for the parts of Supabase (Auth, PostgREST, Storage) and of our API
 * (`/geo/search`) that the web app calls. It exists so the end-to-end suite never needs production
 * or secrets. It is deliberately simple: one process, no persistence, one data set per user (as
 * if every trip were private to its owner), rows validated with the same zod schemas the app uses.
 *
 * Tests drive and inspect it through `/__admin/*` (see `support/backend.ts`).
 */
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  activitySchema,
  checklistItemSchema,
  documentSchema,
  legSchema,
  placeSchema,
  staySchema,
  stopSchema,
  tripSchema,
} from '@wayfare/shared';

type Row = Record<string, unknown>;

interface User {
  id: string;
  email: string;
  password: string;
  user_metadata: Record<string, unknown>;
}

/** Tables the app writes through PostgREST, with the schema each row must satisfy. */
const SCHEMAS: Record<
  string,
  { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } }
> = {
  trips: tripSchema,
  places: placeSchema,
  stops: stopSchema,
  stays: staySchema,
  legs: legSchema,
  activities: activitySchema,
  documents: documentSchema,
  checklist_items: checklistItemSchema,
};

/** Tables whose rows carry `created_by` (the database fills it from `auth.uid()`). */
const CREATED_BY = new Set([
  'stops',
  'stays',
  'legs',
  'activities',
  'documents',
  'checklist_items',
]);

/** Fake search results: a few cities in different countries, matched by prefix. */
const PLACES = [
  {
    name: 'Lisboa',
    name_local: null,
    country_code: 'PT',
    country: 'Portugal',
    region: 'Lisboa',
    lat: 38.7223,
    lng: -9.1393,
  },
  {
    name: 'Porto',
    name_local: null,
    country_code: 'PT',
    country: 'Portugal',
    region: 'Norte',
    lat: 41.1496,
    lng: -8.611,
  },
  {
    name: 'Porto Alegre',
    name_local: null,
    country_code: 'BR',
    country: 'Brasil',
    region: 'Rio Grande do Sul',
    lat: -30.0346,
    lng: -51.2177,
  },
  {
    name: 'Tóquio',
    name_local: '東京都',
    country_code: 'JP',
    country: 'Japão',
    region: 'Tóquio',
    lat: 35.6762,
    lng: 139.6503,
  },
  {
    name: 'Quioto',
    name_local: '京都市',
    country_code: 'JP',
    country: 'Japão',
    region: 'Quioto',
    lat: 35.0116,
    lng: 135.7681,
  },
  {
    name: 'Cidade do México',
    name_local: 'Ciudad de México',
    country_code: 'MX',
    country: 'México',
    region: 'CDMX',
    lat: 19.4326,
    lng: -99.1332,
  },
];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

/** An unsigned JWT: supabase-js decodes the payload (sub, exp) but never checks the signature. */
function accessToken(user: User): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp: now + 3600,
    session_id: randomUUID(),
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fake-signature`;
}

/** Stable id per e-mail, so a test can sign in again on a fresh device and see the same data. */
function userIdFor(email: string): string {
  const h = createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export class FakeBackend {
  private version = 0;
  private readonly users = new Map<string, User>();
  /** Refresh token → user id. */
  private readonly refreshTokens = new Map<string, string>();
  /** user id → table → id → row. */
  private readonly data = new Map<string, Map<string, Map<string, Row>>>();
  /** user id → storage path → file. */
  private readonly files = new Map<string, Map<string, { body: Buffer; type: string }>>();

  // --- users and sessions ------------------------------------------------------------------------

  createUser(email: string, password: string, name?: string): User {
    const user: User = {
      id: userIdFor(email),
      email,
      password,
      user_metadata: name ? { full_name: name } : {},
    };
    this.users.set(email.toLowerCase(), user);
    return user;
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: user.user_metadata,
      identities: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    };
  }

  session(user: User) {
    const refresh = randomUUID();
    this.refreshTokens.set(refresh, user.id);
    return {
      access_token: accessToken(user),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refresh,
      user: this.publicUser(user),
    };
  }

  private userById(id: string): User | undefined {
    for (const u of this.users.values()) if (u.id === id) return u;
    return undefined;
  }

  private userFromRequest(req: IncomingMessage): User | undefined {
    const auth = req.headers.authorization ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    try {
      const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string };
      return sub ? this.userById(sub) : undefined;
    } catch {
      return undefined;
    }
  }

  // --- rows --------------------------------------------------------------------------------------

  private tableOf(userId: string, table: string): Map<string, Row> {
    let tables = this.data.get(userId);
    if (!tables) this.data.set(userId, (tables = new Map()));
    let rows = tables.get(table);
    if (!rows) tables.set(table, (rows = new Map()));
    return rows;
  }

  /** Validates and stores a row as the database would: server-owned columns filled in. */
  private write(
    userId: string,
    table: string,
    row: Row,
  ): { error?: { code: string; message: string } } {
    const schema = SCHEMAS[table];
    if (!schema) return { error: { code: '42P01', message: `relation "${table}" does not exist` } };
    const full: Row = { ...row };
    if (table === 'trips') full.owner_id ??= userId;
    if (CREATED_BY.has(table)) full.created_by ??= userId;
    if (table === 'documents') full.owner_id ??= userId;
    full.version = ++this.version;
    full.updated_at = new Date().toISOString();
    full.deleted_at ??= null;
    const parsed = schema.safeParse(full);
    if (!parsed.success) {
      return {
        error: { code: '23514', message: `check violation on ${table}: ${String(parsed.error)}` },
      };
    }
    // Column defaults (visibility, assignees, booked…) come back filled in, as from Postgres.
    this.tableOf(userId, table).set(String(full.id), { ...full, ...(parsed.data as Row) });
    return {};
  }

  seed(userId: string, rows: Record<string, Row[]>): void {
    for (const [table, list] of Object.entries(rows)) {
      for (const row of list) {
        const { error } = this.write(userId, table, row);
        if (error) throw new Error(error.message);
      }
    }
  }

  /** What a table looks like from the user's side: their own rows plus the derived tables. */
  private visibleRows(user: User, table: string): Row[] {
    if (table === 'trip_members') {
      return [...this.tableOf(user.id, 'trips').values()].map((t) => ({
        trip_id: t.id,
        user_id: user.id,
        role: 'owner',
      }));
    }
    if (table === 'profiles') {
      return [
        { id: user.id, display_name: user.user_metadata.full_name ?? user.email.split('@')[0] },
      ];
    }
    if (table === 'document_links') return [];
    return [...this.tableOf(user.id, table).values()];
  }

  // --- HTTP --------------------------------------------------------------------------------------

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://fake');
    res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS');
    res.setHeader(
      'access-control-allow-headers',
      req.headers['access-control-request-headers'] ?? '*',
    );
    res.setHeader('access-control-expose-headers', 'content-range, x-supabase-api-version');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();

    const body = await readBody(req);
    const path = url.pathname;
    if (path.startsWith('/__admin/')) return this.admin(path, url, body, res);
    if (path.startsWith('/auth/v1/')) return this.auth(path, url, req, body, res);
    if (path.startsWith('/rest/v1/')) return this.rest(path.slice(9), url, req, body, res);
    if (path.startsWith('/storage/v1/object/')) return this.storage(path.slice(19), req, body, res);
    if (path === '/geo/search') {
      if (!this.userFromRequest(req)) return json(res, 401, { error: 'unauthorized' });
      const q = fold(url.searchParams.get('q') ?? '');
      return json(res, 200, { places: PLACES.filter((p) => fold(p.name).startsWith(q)) });
    }
    json(res, 404, { message: `fake backend: no route for ${req.method} ${path}` });
  }

  private admin(path: string, url: URL, body: Buffer, res: ServerResponse) {
    const input = body.length ? (JSON.parse(body.toString()) as Record<string, unknown>) : {};
    if (path === '/__admin/health') return json(res, 200, { ok: true });
    if (path === '/__admin/users') {
      const user = this.createUser(
        String(input.email),
        String(input.password),
        input.name as string | undefined,
      );
      return json(res, 200, { id: user.id, session: this.session(user) });
    }
    if (path === '/__admin/seed') {
      try {
        this.seed(String(input.userId), input.rows as Record<string, Row[]>);
        return json(res, 200, { ok: true });
      } catch (error) {
        return json(res, 400, { message: String(error) });
      }
    }
    if (path === '/__admin/rows') {
      const user = String(url.searchParams.get('user'));
      const table = String(url.searchParams.get('table'));
      return json(res, 200, [...this.tableOf(user, table).values()]);
    }
    if (path === '/__admin/files') {
      const files = this.files.get(String(url.searchParams.get('user'))) ?? new Map();
      return json(
        res,
        200,
        [...files].map(([key, f]) => ({ key, type: f.type, size: f.body.length })),
      );
    }
    json(res, 404, { message: 'unknown admin route' });
  }

  private auth(path: string, url: URL, req: IncomingMessage, body: Buffer, res: ServerResponse) {
    const input = body.length ? (JSON.parse(body.toString()) as Record<string, unknown>) : {};
    if (path === '/auth/v1/settings') {
      return json(res, 200, {
        external: { email: true, google: false, apple: false },
        disable_signup: false,
        mailer_autoconfirm: false,
      });
    }
    if (path === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const user = this.users.get(String(input.email).toLowerCase());
        if (!user || user.password !== input.password) {
          return json(res, 400, {
            code: 400,
            error_code: 'invalid_credentials',
            msg: 'Invalid login credentials',
          });
        }
        return json(res, 200, this.session(user));
      }
      if (grant === 'refresh_token') {
        const id = this.refreshTokens.get(String(input.refresh_token));
        const user = id ? this.userById(id) : undefined;
        if (!user) {
          return json(res, 400, {
            code: 400,
            error_code: 'refresh_token_not_found',
            msg: 'Invalid Refresh Token',
          });
        }
        return json(res, 200, this.session(user));
      }
    }
    if (path === '/auth/v1/logout') return void res.writeHead(204).end();
    const user = this.userFromRequest(req);
    if (path === '/auth/v1/user') {
      if (!user)
        return json(res, 401, { code: 401, error_code: 'no_authorization', msg: 'No user' });
      if (req.method === 'PUT') {
        const data = (input.data ?? {}) as Record<string, unknown>;
        user.user_metadata = { ...user.user_metadata, ...data };
      }
      return json(res, 200, this.publicUser(user));
    }
    // Sign-up, OTP and password reset would send e-mail: never needed by the suite.
    json(res, 400, { code: 400, error_code: 'not_supported', msg: `fake auth: ${path}` });
  }

  private rest(table: string, url: URL, req: IncomingMessage, body: Buffer, res: ServerResponse) {
    const user = this.userFromRequest(req);
    if (!user) return json(res, 401, { code: 'PGRST301', message: 'JWT required' });
    const filters = parseFilters(url.searchParams);
    const prefer = String(req.headers.prefer ?? '');
    const wantsRows = prefer.includes('return=representation');
    const select = url.searchParams.get('select');

    if (req.method === 'GET' || req.method === 'HEAD') {
      let rows = this.visibleRows(user, table).filter((r) => filters.every((f) => f(r)));
      const order = url.searchParams.get('order');
      if (order) {
        const [col, dir] = order.split('.') as [string, string | undefined];
        const sign = dir === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => (Number(a[col]) - Number(b[col])) * sign);
      }
      const limit = url.searchParams.get('limit');
      if (limit) rows = rows.slice(0, Number(limit));
      return json(
        res,
        200,
        rows.map((r) => pick(r, select)),
      );
    }

    const input = body.length ? (JSON.parse(body.toString()) as Row | Row[]) : {};
    if (req.method === 'POST') {
      const list = Array.isArray(input) ? input : [input];
      for (const row of list) {
        if (this.tableOf(user.id, table).has(String(row.id))) {
          return json(res, 409, {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          });
        }
        const { error } = this.write(user.id, table, row);
        if (error) return json(res, 400, error);
      }
      if (!wantsRows) return void res.writeHead(201).end();
      return json(
        res,
        201,
        list.map((r) => pick(this.tableOf(user.id, table).get(String(r.id))!, select)),
      );
    }

    if (req.method === 'PATCH') {
      const changes = input as Row;
      const matched = this.visibleRows(user, table).filter((r) => filters.every((f) => f(r)));
      const updated: Row[] = [];
      for (const row of matched) {
        const { error } = this.write(user.id, table, { ...row, ...changes });
        if (error) return json(res, 400, error);
        updated.push(this.tableOf(user.id, table).get(String(row.id))!);
      }
      if (!wantsRows) return void res.writeHead(204).end();
      return json(
        res,
        200,
        updated.map((r) => pick(r, select)),
      );
    }
    json(res, 405, { message: `fake rest: ${req.method}` });
  }

  private storage(rest: string, req: IncomingMessage, body: Buffer, res: ServerResponse) {
    const user = this.userFromRequest(req);
    if (!user)
      return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'no session' });
    let files = this.files.get(user.id);
    if (!files) this.files.set(user.id, (files = new Map()));
    // rest = "<bucket>/<path>" (upload, download) or "<bucket>" (bulk delete).
    const key = decodeURIComponent(rest);
    if (req.method === 'POST' || req.method === 'PUT') {
      if (files.has(key) && req.method === 'POST') {
        return json(res, 400, {
          statusCode: '409',
          error: 'Duplicate',
          message: 'The resource already exists',
        });
      }
      files.set(key, fileFromUpload(req, body));
      return json(res, 200, { Id: randomUUID(), Key: key });
    }
    if (req.method === 'GET') {
      const file = files.get(key);
      if (!file)
        return json(res, 400, {
          statusCode: '404',
          error: 'not_found',
          message: 'Object not found',
        });
      res.writeHead(200, { 'content-type': file.type });
      return void res.end(file.body);
    }
    if (req.method === 'DELETE') {
      const { prefixes = [] } = JSON.parse(body.toString() || '{}') as { prefixes?: string[] };
      for (const p of prefixes) files.delete(`${key}/${p}`);
      return json(
        res,
        200,
        prefixes.map((name) => ({ name })),
      );
    }
    json(res, 405, { message: `fake storage: ${req.method}` });
  }
}

// --- helpers -------------------------------------------------------------------------------------

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function pick(row: Row, select: string | null): Row {
  if (!select || select === '*') return row;
  const cols = select.split(',').map((c) => c.trim());
  return Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
}

const PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

/** PostgREST horizontal filters: `col=eq.v`, `gt`, `gte`, `lt`, `lte`, `neq`, `in.(a,b)`, `is.null`. */
function parseFilters(params: URLSearchParams): ((row: Row) => boolean)[] {
  const filters: ((row: Row) => boolean)[] = [];
  for (const [col, expr] of params) {
    if (PARAMS.has(col)) continue;
    const dot = expr.indexOf('.');
    const op = expr.slice(0, dot);
    const value = expr.slice(dot + 1);
    const num = (v: unknown) => Number(v);
    switch (op) {
      case 'eq':
        filters.push((r) => String(r[col]) === value);
        break;
      case 'neq':
        filters.push((r) => String(r[col]) !== value);
        break;
      case 'gt':
        filters.push((r) => num(r[col]) > num(value));
        break;
      case 'gte':
        filters.push((r) => num(r[col]) >= num(value));
        break;
      case 'lt':
        filters.push((r) => num(r[col]) < num(value));
        break;
      case 'lte':
        filters.push((r) => num(r[col]) <= num(value));
        break;
      case 'is':
        filters.push((r) => (value === 'null' ? r[col] == null : String(r[col]) === value));
        break;
      case 'in': {
        const set = new Set(
          value
            .replace(/^\(|\)$/g, '')
            .split(',')
            .map((v) => v.replace(/^"|"$/g, '')),
        );
        filters.push((r) => set.has(String(r[col])));
        break;
      }
      default:
        throw new Error(`fake rest: unsupported filter ${col}=${expr}`);
    }
  }
  return filters;
}

/** storage-js sends a Blob as multipart form data (a `cacheControl` field and the file part). */
function fileFromUpload(req: IncomingMessage, body: Buffer): { body: Buffer; type: string } {
  const type = String(req.headers['content-type'] ?? 'application/octet-stream');
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
  if (!type.startsWith('multipart/form-data') || !boundary) return { body, type };
  const sep = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let start = body.indexOf(sep);
  while (start !== -1) {
    const next = body.indexOf(sep, start + sep.length);
    if (next === -1) break;
    const part = body.subarray(start + sep.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    const headers = part.subarray(0, headerEnd).toString();
    if (/filename=/i.test(headers)) {
      const partType =
        /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? 'application/octet-stream';
      return { body: Buffer.from(part.subarray(headerEnd + 4)), type: partType };
    }
    start = next;
  }
  return { body, type };
}

export function startFakeBackend(port: number): Promise<{ backend: FakeBackend; server: Server }> {
  const backend = new FakeBackend();
  const server = createServer((req, res) => {
    backend.handle(req, res).catch((error: unknown) => {
      console.error('[fake-backend]', error);
      if (!res.headersSent) json(res, 500, { message: String(error) });
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ backend, server })));
}
