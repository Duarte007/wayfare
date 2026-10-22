import { backend } from '../support/backend.ts';
import { expect, expectPulled, signInWithSession, test } from '../support/fixtures.ts';
import { msg } from '../support/i18n.ts';
import { plannedTrip } from '../support/seed.ts';

/**
 * Screens are lazy chunks and locales load on demand: after one visit online, the service worker
 * must have precached all of them, so every screen opens (and the language switches) offline.
 */
test('every screen opens offline after the first visit, and the language still switches', async ({
  page,
  context,
  user,
}) => {
  test.setTimeout(90_000);
  const trip = plannedTrip(user.id, 'Viagem de teste');
  await backend.seed(user.id, trip.rows);
  await signInWithSession(context, user);

  await page.goto('/');
  await expectPulled(page, Object.keys(trip.rows));
  // The first visit installs the service worker and precaches the app; a reload puts it in charge.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  const tripHeading = page.getByRole('heading', { level: 1, name: 'Viagem de teste' });
  const screens: [path: string, ready: () => ReturnType<typeof page.getByRole>][] = [
    [`/trips/${trip.tripId}`, () => tripHeading],
    [
      `/trips/${trip.tripId}/calendar`,
      () => page.getByRole('heading', { level: 1, name: msg('pt-BR', 'calendar.title') }),
    ],
    [
      `/trips/${trip.tripId}/checklist`,
      () => page.getByRole('heading', { level: 1, name: msg('pt-BR', 'checklist.title') }),
    ],
    [
      `/trips/${trip.tripId}/documents`,
      () => page.getByRole('heading', { level: 1, name: msg('pt-BR', 'documents.title') }),
    ],
    [
      `/trips/${trip.tripId}/map`,
      () => page.getByRole('heading', { level: 1, name: msg('pt-BR', 'maps.title') }),
    ],
    [`/trips/${trip.tripId}/edit`, () => page.getByLabel(msg('pt-BR', 'trips.tripName'))],
    ['/trips/new', () => page.getByLabel(msg('pt-BR', 'trips.tripName'))],
    [
      '/this/does/not/exist',
      () => page.getByRole('heading', { name: msg('pt-BR', 'app.notFoundTitle') }),
    ],
    ['/profile', () => page.getByRole('heading', { name: msg('pt-BR', 'profile.account') })],
  ];
  for (const [path, ready] of screens) {
    await page.goto(path);
    await expect(ready(), `${path} offline`).toBeVisible();
  }

  // The date picker is its own chunk too.
  await page.goto('/trips/new');
  await page.getByRole('button', { name: msg('pt-BR', 'trips.dates'), exact: true }).click();
  await expect(page.getByRole('grid').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // Another language's messages come from the precache as well.
  await page.goto('/profile');
  await page.getByLabel(msg('pt-BR', 'common.language')).click();
  await page.getByRole('option', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: msg('en', 'profile.account') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: msg('en', 'profile.account') })).toBeVisible();
});
