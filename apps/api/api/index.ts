// Vercel Function entry: every path is rewritten here (see vercel.json) and routed by Hono.
import { handle } from 'hono/vercel';
import { app } from '../src/main.js';

const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
