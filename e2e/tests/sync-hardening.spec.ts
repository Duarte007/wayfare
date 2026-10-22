import type { Page } from '@playwright/test';
import { backend } from '../support/backend.ts';
import {
  expect,
  expectAccessible,
  expectPulled,
  signInWithSession,
  test,
} from '../support/fixtures.ts';
import { plannedTrip } from '../support/seed.ts';

/** Writes a row and its outbox entry straight into the device store, as the app would. */
function queueOnDevice(page: Page, table: string, row: Record<string, unknown>) {
  return page.evaluate(
    ([table, row]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('wayfare');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction([table, 'outbox'], 'readwrite');
          tx.objectStore(table).put(row);
          tx.objectStore('outbox').put({
            id: crypto.randomUUID(),
            table,
            op: 'upsert',
            row,
            createdAt: Date.now(),
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [table, row] as const,
  );
}

function deviceHas(page: Page, table: string, id: string): Promise<boolean> {
  return page.evaluate(
    ([table, id]) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('wayfare');
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction(table).objectStore(table).get(id);
          get.onsuccess = () => {
            resolve(get.result !== undefined);
            db.close();
          };
        };
      }),
    [table, id] as const,
  );
}

test('"Atualizar tudo" removes rows the server no longer has and shows when it ran', async ({
  page,
  context,
  user,
}) => {
  const { tripId, rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);
  await page.goto(`/trips/${tripId}`);
  await expectPulled(page, Object.keys(rows));
  await expect(page.getByRole('button', { name: 'Editar Museu do Azulejo' })).toBeVisible();

  // Gone from the server without a deleted copy: the regular sync never hears about it.
  const activityId = String(rows.activities![0]!.id);
  await backend.forget(user.id, 'activities', activityId);

  await page.goto('/profile');
  const card = page.locator('[data-slot="card"]').filter({
    has: page.getByRole('heading', { name: 'Sincronização', exact: true }),
  });
  // The first sync on a device is a full one.
  await expect(card.getByText('Última atualização completa')).toBeVisible();
  await expect(card.getByText('Ainda não', { exact: true })).toHaveCount(0);
  await expectAccessible(page, 'profile sync card');

  await context.setOffline(true);
  await expect(card.getByRole('button', { name: 'Atualizar tudo' })).toBeDisabled();
  await expect(card.getByText('Conecte-se à internet para atualizar.')).toBeVisible();
  await context.setOffline(false);

  await card.getByRole('button', { name: 'Atualizar tudo' }).click();
  await expect(card.getByText('Tudo está em dia.')).toBeVisible();
  await expect.poll(() => deviceHas(page, 'activities', activityId)).toBe(false);

  await page.goto(`/trips/${tripId}`);
  await expect(page.locator('ol h3')).toHaveText(['Lisboa', 'Porto']);
  await expect(page.getByRole('button', { name: 'Editar Museu do Azulejo' })).toHaveCount(0);
});

test('a change the server refuses shows under "Problemas de sincronização"; retry and discard', async ({
  page,
  context,
  user,
}) => {
  const { tripId, rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);
  await page.goto('/profile');
  await expectPulled(page, Object.keys(rows));
  await expect(page.getByRole('heading', { name: 'Problemas de sincronização' })).toHaveCount(0);

  // A row the server's checks refuse (its city reference is not a valid id).
  const refusedId = crypto.randomUUID();
  await queueOnDevice(page, 'activities', {
    id: refusedId,
    trip_id: tripId,
    stop_id: 'not-a-city',
    title: 'Passeio recusado',
    visibility: 'group',
    assignees: [],
  });
  // Written behind the app's back, so start it again: its first pass sends the change, and the
  // server's refusal sets it aside instead of blocking the queue.
  await page.reload();
  const section = page.locator('[data-slot="card"]').filter({
    has: page.getByRole('heading', { name: 'Problemas de sincronização' }),
  });
  await expect(section).toBeVisible();
  await expect(section.getByText('Passeio recusado')).toBeVisible();
  await expect(section.getByText('O servidor recusou esta alteração.')).toBeVisible();
  await expect(section.getByText(/^Atividade · alterado em /)).toBeVisible();
  // The tab bar tells about it from anywhere.
  await expect(
    page.getByRole('navigation').getByRole('link', { name: /1 problema de sincronização/ }),
  ).toBeVisible();
  await expectAccessible(page, 'profile with a sync issue');

  // Retry: sent again, refused again, still listed.
  await section.getByRole('button', { name: 'Tentar de novo: Passeio recusado' }).click();
  await expect(section.getByText('Enviado de novo; o servidor ainda recusa.')).toBeVisible();
  await expect(section.getByText('Passeio recusado')).toBeVisible();

  // Discard: asks first, then the change and the device's copy are gone.
  await section.getByRole('button', { name: 'Descartar: Passeio recusado' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Descartar a alteração em Passeio recusado?');
  await dialog.getByRole('button', { name: 'Descartar' }).click();
  await expect(section).toBeHidden();
  await expect.poll(() => deviceHas(page, 'activities', refusedId)).toBe(false);
  expect(
    (await backend.rows(user.id, 'activities')).map((a) => a.id),
    'the refused row never reached the server',
  ).not.toContain(refusedId);
});
