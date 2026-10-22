#!/usr/bin/env node
// Bundle-size guard: fails when the first load (what dist/index.html fetches before anything is
// lazy-loaded — the entry script, its modulepreloads and stylesheets) grows past the budget.
// Run after `vite build`: `node scripts/check-bundle-size.mjs [distDir]`.
//
// What counts: the entry script, every chunk index.html modulepreloads, the stylesheet, and the
// biggest locale chunk (the app renders once the active locale's messages are in).
//
// Budget: before route splitting (roadmap item 17) this was ~411 KB gzipped (one 1.4 MB chunk with
// every page, zod, the date picker and all five locales). After it, ~262 KB: what is left is the
// floor for an offline-first shell that signs in and lists trips from IndexedDB (react-dom ~58,
// supabase-js ~50, router ~30, Dexie ~27, i18next + ICU ~30, tailwind-merge ~14, CSS ~11, one
// locale ~8, app code). The budget sits a little above that, so a small change passes but pulling
// a feature page, zod, the date picker or every locale back into the first load fails CI. Change it
// only on purpose, and say why in the PR.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 275;

const dist = resolve(process.argv[2] ?? 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const files = new Set();
for (const tag of html.match(/<(script|link)\b[^>]*>/g) ?? []) {
  const isEntry = /^<script\b/.test(tag) && /type="module"/.test(tag);
  const isPreload = /rel="(modulepreload|stylesheet)"/.test(tag);
  const url = tag.match(/(?:src|href)="\/?([^"]+)"/)?.[1];
  if ((isEntry || isPreload) && url && /\.(js|css)$/.test(url)) files.add(url);
}
if (files.size === 0) {
  console.error(`No entry script found in ${join(dist, 'index.html')}; run vite build first.`);
  process.exit(1);
}

// The app renders after the active locale's messages arrive, so one locale chunk is part of the
// first load too. Count the biggest one (the worst case).
const locales = readdirSync(join(dist, 'assets'))
  .filter((name) => /^(en|pt-BR|zh-CN|es|ja)-[\w-]+\.js$/.test(name))
  .map((name) => `assets/${name}`);
const gzipOf = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length;
if (locales.length > 0) files.add(locales.reduce((a, b) => (gzipOf(a) >= gzipOf(b) ? a : b)));
else console.log('No per-locale chunks: every locale is bundled into the entry.');

const kb = (bytes) => bytes / 1024;
let raw = 0;
let gzip = 0;
const rows = [...files].map((file) => {
  const content = readFileSync(join(dist, file));
  const zipped = gzipOf(file);
  raw += content.length;
  gzip += zipped;
  return { file, raw: content.length, gzip: zipped };
});

rows.sort((a, b) => b.gzip - a.gzip);
for (const row of rows) {
  console.log(
    `${kb(row.raw).toFixed(1).padStart(9)} kB │ gzip ${kb(row.gzip).toFixed(1).padStart(7)} kB  ${row.file}`,
  );
}
console.log(
  `First load: ${kb(raw).toFixed(1)} kB, ${kb(gzip).toFixed(1)} kB gzipped (budget ${BUDGET_KB} kB gzipped)`,
);

if (kb(gzip) > BUDGET_KB) {
  console.error(
    `First load is over budget by ${(kb(gzip) - BUDGET_KB).toFixed(1)} kB gzipped. Load the new code ` +
      'on demand (a lazy route or a dynamic import), or raise BUDGET_KB in this script on purpose.',
  );
  process.exit(1);
}
