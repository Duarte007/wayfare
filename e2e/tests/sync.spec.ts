import { backend } from '../support/backend.ts';
import { expect, expectSynced, outboxCount, signInWithSession, test } from '../support/fixtures.ts';
import { plannedTrip } from '../support/seed.ts';

test('changes made offline wait in the outbox and reach the server when back online', async ({
  page,
  context,
  browser,
  user,
}) => {
  const { tripId, rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);

  // The trip comes down from the server on the first sync.
  await page.goto(`/trips/${tripId}`);
  await expect(page.locator('ol h3')).toHaveText(['Lisboa', 'Porto']);
  await expectSynced(page);

  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();

  // Two edits on the device: tick a booking and add an activity.
  await page.getByRole('checkbox', { name: 'Museu do Azulejo reservado' }).click();
  await page.getByRole('button', { name: 'Adicionar atividade' }).nth(1).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('O que', { exact: true }).fill('Jantar na Ribeira');
  await dialog.getByRole('button', { name: 'Adicionar atividade' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar Jantar na Ribeira' })).toBeVisible();

  await expect.poll(() => outboxCount(page)).toBe(2);
  // The count badge lives in the sidebar, which only shows from the desktop breakpoint.
  await expect(page.getByText('2 alterações aguardando sincronização')).toBeAttached();
  const before = await backend.rows(user.id, 'activities');
  expect(before).toEqual([expect.objectContaining({ title: 'Museu do Azulejo', booked: false })]);

  // Back online: the app syncs on the `online` event, without a reload.
  await context.setOffline(false);
  await expectSynced(page);
  await expect(page.getByText(/aguardando sincronização/)).not.toBeAttached();
  await expect
    .poll(async () => (await backend.rows(user.id, 'activities')).map((a) => [a.title, a.booked]))
    .toEqual(
      expect.arrayContaining([
        ['Museu do Azulejo', true],
        ['Jantar na Ribeira', false],
      ]),
    );

  // A second device signed in as the same person gets both changes.
  const other = await browser.newContext({
    locale: 'pt-BR',
    viewport: { width: 390, height: 844 },
  });
  await other.addInitScript(() => localStorage.setItem('wayfare.locale', 'pt-BR'));
  await signInWithSession(other, user);
  const second = await other.newPage();
  await second.goto(`/trips/${tripId}`);
  await expect(second.getByRole('button', { name: 'Editar Jantar na Ribeira' })).toBeVisible();
  await expect(second.getByRole('checkbox', { name: 'Museu do Azulejo reservado' })).toBeChecked();
  await other.close();
});
