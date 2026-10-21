import { expect, test, type Locator, type Page } from '@playwright/test';
import { BACKEND_URL } from './env.ts';

/** Everything a person can click or tap. */
const SELECTOR =
  'a[href], button, [role=button], [role=combobox], [role=radio], [role=tab], [role=checkbox], [role=switch], [role=menuitem]';

interface Item {
  index: number;
  key: string;
  disabled: boolean;
  /** Already the current page or the selected option: clicking it rightly does nothing. */
  active: boolean;
}

/** Visible, interactive elements in document order, with a role + name key to re-find them. */
function describe(page: Page): Promise<Item[]> {
  return page.$$eval(SELECTOR, (els) =>
    els
      .map((e, index) => ({ e: e as HTMLElement, index }))
      .filter(({ e }) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        // Off-screen until focused (the skip link): keyboard-only, not a click target.
        const offScreen =
          r.right <= 0 ||
          r.bottom <= 0 ||
          s.clipPath.startsWith('inset(50%') ||
          s.clip === 'rect(0px, 0px, 0px, 0px)';
        return (
          r.width > 1 &&
          r.height > 1 &&
          !offScreen &&
          s.visibility !== 'hidden' &&
          !e.closest('[aria-hidden=true],[inert]')
        );
      })
      .map(({ e, index }) => {
        const role = e.getAttribute('role') ?? (e.tagName === 'A' ? 'link' : 'button');
        const name = (e.getAttribute('aria-label') ?? e.innerText ?? e.getAttribute('title') ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80);
        return {
          index,
          key: `${role} "${name}"`,
          disabled: (e as HTMLButtonElement).disabled || e.getAttribute('aria-disabled') === 'true',
          active:
            e.getAttribute('aria-current') === 'page' ||
            (['radio', 'tab'].includes(role) &&
              (e.getAttribute('aria-checked') === 'true' ||
                e.getAttribute('aria-selected') === 'true')),
        };
      }),
  );
}

/** What a click can change: where we are, what is open, what is shown, which states flipped. */
function snapshot(page: Page): Promise<string> {
  return page.evaluate(() => {
    const overlays = document.querySelectorAll(
      '[role=dialog],[role=alertdialog],[role=listbox],[role=menu],[data-slot=popover-content]',
    ).length;
    const states = [
      ...document.querySelectorAll('[aria-expanded],[aria-checked],[aria-pressed],[data-state]'),
    ]
      .map((e) =>
        ['aria-expanded', 'aria-checked', 'aria-pressed', 'data-state']
          .map((a) => e.getAttribute(a))
          .join(),
      )
      .join('|');
    const root = document.documentElement;
    return JSON.stringify([
      location.pathname + location.search + location.hash,
      overlays,
      document.body.innerText,
      states,
      root.lang,
      root.className,
      root.dataset.theme ?? '',
    ]);
  });
}

export interface ClickAuditOptions {
  /** Shown when the screen is ready to be clicked. */
  ready: (page: Page) => Locator;
  /** Accessible names not to click: they sign out or delete for real. */
  skip?: string[];
}

/**
 * Clicks every visible button, link and control on a screen (reloading it before each one) and
 * fails listing those that did nothing: no navigation, no overlay, no visible change, no state
 * change, no new tab or download and no request to the server.
 */
export async function expectNoDeadClicks(page: Page, path: string, options: ClickAuditOptions) {
  const locale = await page.evaluate(() => localStorage.getItem('wayfare.locale'));
  const open = async () => {
    // A click may switch the language or theme; every element starts from the same screen.
    await page.evaluate((l) => {
      if (l) localStorage.setItem('wayfare.locale', l);
      localStorage.removeItem('wayfare.theme');
    }, locale);
    await page.goto(path);
    await expect(options.ready(page)).toBeVisible();
  };

  await open();
  const items = await stableItems(page);
  expect(items.length, `interactive elements on ${path}`).toBeGreaterThan(0);
  const dead: string[] = [];
  const seen = new Map<string, number>();
  let clicked = 0;

  for (const item of items) {
    const nth = seen.get(item.key) ?? 0;
    seen.set(item.key, nth + 1);
    const label = nth ? `${item.key} #${nth + 1}` : item.key;
    if (item.disabled || item.active || options.skip?.some((s) => item.key.includes(`"${s}"`))) {
      continue;
    }
    clicked++;
    await open();
    const current = await stableItems(page);
    const target = current.filter((c) => c.key === item.key)[nth];
    if (!target) {
      dead.push(`${label}: not found after reload`);
      continue;
    }

    // Side effects outside the page: a request to the server, a new tab, a download.
    let outside = 0;
    const onRequest = (r: { url: () => string }) => {
      if (r.url().startsWith(BACKEND_URL)) outside++;
    };
    const onPage = (p: Page) => {
      outside++;
      void p.close();
    };
    const onDownload = () => outside++;
    page.on('request', onRequest);
    page.context().on('page', onPage);
    page.on('download', onDownload);
    const before = await snapshot(page);
    let effect = true;
    try {
      await page.locator(SELECTOR).nth(target.index).click({ timeout: 3000 });
      effect = await expect
        .poll(async () => outside > 0 || (await snapshot(page).catch(() => 'left')) !== before, {
          timeout: 1500,
        })
        .toBe(true)
        .then(() => true)
        .catch(() => false);
      if (!effect) dead.push(`${label}: no effect`);
    } catch (error) {
      dead.push(`${label}: click failed (${String(error).split('\n')[0]})`);
    } finally {
      page.off('request', onRequest);
      page.context().off('page', onPage);
      page.off('download', onDownload);
    }
  }

  test.info().annotations.push({
    type: 'click audit',
    description: `${path}: ${clicked} elements clicked, ${items.length - clicked} skipped (disabled, current or destructive)`,
  });
  expect(dead, `dead clicks on ${path}`).toEqual([]);
}

/** The element list once rendering settled (two equal reads in a row). */
async function stableItems(page: Page): Promise<Item[]> {
  let previous = '';
  let items: Item[] = [];
  await expect
    .poll(async () => {
      items = await describe(page);
      const key = items.map((i) => i.key).join('\n');
      const same = key === previous;
      previous = key;
      return same;
    })
    .toBe(true);
  return items;
}
