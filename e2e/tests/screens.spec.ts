import type { Page } from '@playwright/test';
import { backend } from '../support/backend.ts';
import { expectNoDeadClicks } from '../support/click-audit.ts';
import {
  expect,
  expectAccessible,
  expectNoHorizontalScroll,
  expectPulled,
  signInWithSession,
  test,
} from '../support/fixtures.ts';
import { msg } from '../support/i18n.ts';
import { plannedTrip } from '../support/seed.ts';

/**
 * The main screens with a planned trip on the device, in each project's language and viewport:
 * they open, pass axe (WCAG 2.1 A/AA) and have no dead clicks.
 */
test.describe('screens', () => {
  let tripId: string;

  test.beforeEach(async ({ context, page, user }) => {
    const trip = plannedTrip(user.id, 'Viagem de teste');
    tripId = trip.tripId;
    await backend.seed(user.id, trip.rows);
    await signInWithSession(context, user);
    await page.goto('/');
    await expectPulled(page, Object.keys(trip.rows));
    await expect(page.getByRole('link', { name: /Viagem de teste/ })).toBeVisible();
  });

  const tripHeading = (page: Page) =>
    page.getByRole('heading', { level: 1, name: 'Viagem de teste' });

  test('trips list', async ({ page, locale }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: msg(locale, 'trips.greeting') }),
    ).toBeVisible();
    await expectAccessible(page, 'trips list');
    await expectNoHorizontalScroll(page, 'trips list');
    await expectNoDeadClicks(page, '/', {
      ready: (p) => p.getByRole('link', { name: /Viagem de teste/ }),
    });
  });

  test('trip page', async ({ page, locale }) => {
    await page.goto(`/trips/${tripId}`);
    await expect(tripHeading(page)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: msg(locale, 'trips.missingTitle') }),
    ).toBeVisible();
    await expectAccessible(page, 'trip page');
    await expectNoHorizontalScroll(page, 'trip page');
    await expectNoDeadClicks(page, `/trips/${tripId}`, { ready: tripHeading });
  });

  test('profile', async ({ page, locale }) => {
    await page.goto('/profile');
    const ready = (p: Page) => p.getByRole('heading', { name: msg(locale, 'profile.account') });
    await expect(ready(page)).toBeVisible();
    await expectAccessible(page, 'profile');
    await expectNoHorizontalScroll(page, 'profile');
    await expectNoDeadClicks(page, '/profile', { ready, skip: [msg(locale, 'common.signOut')] });
  });

  test('new trip, calendar, checklist and documents open and pass axe', async ({
    page,
    locale,
  }) => {
    await page.goto('/trips/new');
    await expect(page.getByLabel(msg(locale, 'trips.tripName'))).toBeVisible();
    await expectAccessible(page, 'new trip');
    await expectNoHorizontalScroll(page, 'new trip');

    for (const [path, title] of [
      ['calendar', 'calendar.title'],
      ['checklist', 'checklist.title'],
      ['documents', 'documents.title'],
    ] as const) {
      await page.goto(`/trips/${tripId}/${path}`);
      await expect(page.getByRole('heading', { level: 1, name: msg(locale, title) })).toBeVisible();
      await expectAccessible(page, path);
      await expectNoHorizontalScroll(page, path);
    }
    // The seeded checklist item made it to the checklist.
    await page.goto(`/trips/${tripId}/checklist`);
    await expect(page.getByText('Passaporte válido')).toBeVisible();
  });

  test('unknown URLs show the 404 page with a way back', async ({ page, locale }) => {
    await page.goto('/this/does/not/exist');
    await expect(
      page.getByRole('heading', { name: msg(locale, 'app.notFoundTitle') }),
    ).toBeVisible();
    await expectAccessible(page, '404');
    await expectNoHorizontalScroll(page, '404');
    await page.getByRole('link', { name: msg(locale, 'app.goToTrips') }).click();
    await expect(page.getByRole('link', { name: /Viagem de teste/ })).toBeVisible();
  });
});
