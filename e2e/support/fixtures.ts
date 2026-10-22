import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { backend, type TestUser } from './backend.ts';
import { AUTH_STORAGE_KEY } from './env.ts';

interface Fixtures {
  /** A fresh account on the fake backend, with no data. */
  user: TestUser;
  /** Errors thrown in the page; a test fails if any is left at the end. */
  pageErrors: string[];
}

export const test = base.extend<Fixtures>({
  // Playwright requires the destructuring pattern, even when no other fixture is needed.
  // eslint-disable-next-line no-empty-pattern
  user: async ({}, use) => {
    await use(await backend.createUser());
  },
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
  context: async ({ context, locale }, use) => {
    // The app follows the browser language too; pinning it keeps every test in the project's.
    await context.addInitScript((lang) => {
      if (!localStorage.getItem('wayfare.locale')) localStorage.setItem('wayfare.locale', lang);
    }, locale ?? 'en');
    await use(context);
  },
});

export { expect };

/** Starts the device signed in (the session supabase-js would have saved), skipping the form. */
export async function signInWithSession(context: BrowserContext, user: TestUser): Promise<void> {
  await context.addInitScript(
    ([key, session]) => {
      if (!sessionStorage.getItem('e2e.seeded')) {
        localStorage.setItem(key, session);
        sessionStorage.setItem('e2e.seeded', '1');
      }
    },
    [AUTH_STORAGE_KEY, JSON.stringify(user.session)] as const,
  );
}

/** Changes saved on the device that the server has not accepted yet (the sync outbox). */
export function outboxCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('wayfare');
        // Before the app has created its database: report empty instead of creating one.
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => (open.error?.name === 'AbortError' ? resolve(0) : reject(open.error));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('outbox')) {
            db.close();
            return resolve(0);
          }
          const count = db.transaction('outbox').objectStore('outbox').count();
          count.onsuccess = () => {
            resolve(count.result);
            db.close();
          };
        };
      }),
  );
}

/**
 * Waits until the first sync pulled every given table (its cursor is saved after each page), so a
 * test never acts on a half-downloaded trip.
 */
export async function expectPulled(page: Page, tables: string[]): Promise<void> {
  const missing = () =>
    page.evaluate(
      (names) =>
        new Promise<string[]>((resolve) => {
          const open = indexedDB.open('wayfare');
          // Never create the database (or hold it open) before the app does: an empty one left
          // open blocks the app's own upgrade, and the app hangs on its loading screen.
          open.onupgradeneeded = () => open.transaction?.abort();
          open.onerror = () => resolve(names);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('meta')) {
              db.close();
              return resolve(names);
            }
            const store = db.transaction('meta').objectStore('meta');
            const left: string[] = [];
            let pending = names.length;
            for (const name of names) {
              const get = store.get(`sync.cursor.${name}`);
              get.onsuccess = () => {
                if (!get.result) left.push(name);
                if (--pending === 0) {
                  db.close();
                  resolve(left);
                }
              };
            }
          };
        }),
      tables,
    );
  await expect.poll(missing, { message: 'tables not pulled yet' }).toEqual([]);
}

/**
 * Nothing wider than the screen: on a phone, a page that overflows makes the browser widen the
 * layout viewport, and taps land off target.
 */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > width + 0.5)
      .filter((e) => !e.closest('[data-radix-popper-content-wrapper]'))
      .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 40)}"`)
      .slice(0, 5);
  });
  expect(overflow, `elements wider than the screen on ${label}`).toEqual([]);
}

/** Waits until every local change has reached the (fake) server. */
export async function expectSynced(page: Page): Promise<void> {
  await expect.poll(() => outboxCount(page), { message: 'outbox should drain' }).toBe(0);
}

/** The tags used in manual QA (WCAG 2.0 A/AA and 2.1 AA): zero violations. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
}
