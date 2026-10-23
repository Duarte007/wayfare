import { readFile } from 'node:fs/promises';
import { backend } from '../support/backend.ts';
import {
  expect,
  expectAccessible,
  expectNoHorizontalScroll,
  expectPulled,
  signInWithSession,
  test,
} from '../support/fixtures.ts';
import { plannedTrip } from '../support/seed.ts';

test('"Baixar meus dados" downloads a JSON file with the trip', async ({ page, context, user }) => {
  const { tripId, rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);
  await page.goto('/profile');
  await expectPulled(page, Object.keys(rows));

  const card = page.locator('[data-slot="card"]').filter({
    has: page.getByRole('heading', { name: 'Seus dados', exact: true }),
  });
  await expectAccessible(page, 'profile data card');
  await expectNoHorizontalScroll(page, 'profile data card');

  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Baixar meus dados' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^wayfare-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile((await file.path())!, 'utf8')) as {
    format: string;
    account: { id: string };
    tables: Record<string, { id: string }[]>;
  };
  expect(data.format).toBe('wayfare-export');
  expect(data.account.id).toBe(user.id);
  expect(data.tables.trips?.map((trip) => trip.id)).toContain(tripId);
  expect(data.tables.stops?.length).toBe(rows.stops?.length);
  await expect(card.getByText('Baixado.', { exact: true })).toBeVisible();
});

test('"Excluir minha conta" deletes the account after typing the word and lands on sign-in', async ({
  page,
  context,
  user,
}) => {
  const { rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);
  await page.goto('/profile');
  await expectPulled(page, Object.keys(rows));

  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Excluir sua conta?' });
  await expect(dialog).toBeVisible();
  await expectAccessible(page, 'delete account dialog');
  const confirm = dialog.getByRole('button', { name: 'Excluir para sempre' });
  await expect(confirm).toBeDisabled();

  // Cancel keeps everything.
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect(await backend.rows(user.id, 'trips')).toHaveLength(1);

  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  await dialog.getByLabel('Digite “excluir” para confirmar').fill('excluir');
  await confirm.click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Sua conta e seus dados foram excluídos.' }),
  ).toBeVisible();
  expect(await backend.rows(user.id, 'trips')).toHaveLength(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open('wayfare');
            open.onsuccess = () => {
              const req = open.result.transaction('trips').objectStore('trips').count();
              req.onsuccess = () => resolve(req.result);
            };
          }),
      ),
    )
    .toBe(0);
});
