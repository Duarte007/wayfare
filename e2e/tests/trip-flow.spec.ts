import type { Page } from '@playwright/test';
import { backend } from '../support/backend.ts';
import { expect, expectSynced, signInWithSession, test } from '../support/fixtures.ts';

/** The "O que falta" card on the trip page. */
const missing = (page: Page) =>
  page
    .getByRole('heading', { name: 'O que falta' })
    .locator('xpath=ancestor::div[@data-slot="card"]');

async function pickDay(page: Page, day: number) {
  await page
    .getByRole('gridcell')
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first()
    .click();
}

async function addCity(page: Page, query: string, result: RegExp, nights: number) {
  await page.getByRole('button', { name: /^Adicionar (a primeira )?cidade$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox', { name: 'Cidade' }).fill(query);
  await dialog
    .getByRole('list', { name: 'Resultados da busca' })
    .getByRole('button', { name: result })
    .click();
  // The nights stepper starts with the nights left in the trip.
  const stepper = dialog.locator('output');
  for (;;) {
    const current = parseInt((await stepper.textContent()) ?? '', 10);
    if (current === nights) break;
    const next = current > nights ? current - 1 : current + 1;
    await dialog
      .getByRole('button', { name: current > nights ? 'Uma noite a menos' : 'Uma noite a mais' })
      .click();
    await expect(stepper).toHaveText(next === 1 ? '1 noite' : `${next} noites`);
  }
  await dialog.getByRole('button', { name: 'Adicionar cidade' }).click();
  await expect(dialog).toBeHidden();
}

test('plan a trip: dates, two cities, a stay, a train and an activity', async ({
  page,
  context,
  user,
}) => {
  await signInWithSession(context, user);
  await page.goto('/');
  await page.getByRole('link', { name: 'Nova viagem' }).first().click();

  // New trip with the range picker: the 5th to the 9th of next month (4 nights).
  await page.getByLabel('Nome da viagem').fill('Férias de teste');
  await page.getByRole('button', { name: 'Datas' }).click();
  const picker = page.getByRole('dialog', { name: 'Datas' });
  await picker.getByRole('button', { name: /próximo|next/i }).click();
  await pickDay(page, 5);
  await pickDay(page, 9);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Criar viagem' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Férias de teste' })).toBeVisible();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);

  // Two cities from the (fake) city search; the stepper splits the 4 nights 2 + 2.
  await addCity(page, 'Lisb', /Lisboa/, 2);
  await addCity(page, 'Port', /^Porto(?! Alegre)/, 2);
  await expect(page.locator('ol h3')).toHaveText(['Lisboa', 'Porto']);
  await expect(missing(page)).toContainText('Sem hospedagem para 2 noites em Lisboa');
  await expect(missing(page)).toContainText('Como você vai de Lisboa para Porto?');

  // A stay in Lisboa.
  await page.getByRole('button', { name: 'Adicionar hospedagem' }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Onde você vai dormir').fill('Hotel do Rio');
  await dialog.getByLabel('Código da reserva').fill('ABC123');
  await dialog.getByRole('button', { name: 'Adicionar hospedagem' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar Hotel do Rio' })).toBeVisible();
  await expect(missing(page)).not.toContainText('em Lisboa');

  // The train from Lisboa to Porto, with local times in each city's time zone.
  await page.getByRole('button', { name: 'Transporte ainda não definido' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Trem' }).click();
  await expect(dialog.getByRole('radio', { name: 'Trem' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('combobox', { name: 'Fuso horário' })).toHaveCount(2);
  await dialog.getByLabel('Empresa').fill('CP');
  await dialog.getByLabel('Número do voo ou trem').fill('ap 123');
  const times = dialog.getByLabel('Horário', { exact: true });
  await times.nth(0).fill('09:00');
  await times.nth(1).fill('12:00');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Trem · CP AP 123/ })).toBeVisible();
  await expect(missing(page)).not.toContainText('Como você vai');

  // An activity that needs booking shows up in "O que falta" until it is ticked.
  await page.getByRole('button', { name: 'Adicionar atividade' }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('O que', { exact: true }).fill('Museu do Azulejo');
  await dialog.getByRole('switch', { name: 'Precisa reservar' }).click();
  await dialog.getByRole('button', { name: 'Adicionar atividade' }).click();
  await expect(dialog).toBeHidden();
  await expect(missing(page)).toContainText('Museu do Azulejo: falta reservar');
  await page.getByRole('checkbox', { name: 'Museu do Azulejo reservado' }).click();
  await expect(missing(page)).not.toContainText('Museu do Azulejo');

  // Everything reached the server.
  await expectSynced(page);
  const [trips, stops, stays, legs, activities] = await Promise.all(
    ['trips', 'stops', 'stays', 'legs', 'activities'].map((t) => backend.rows(user.id, t)),
  );
  expect(trips).toEqual([expect.objectContaining({ name: 'Férias de teste', owner_id: user.id })]);
  expect(stops).toHaveLength(2);
  expect(stays).toEqual([expect.objectContaining({ name: 'Hotel do Rio', booking_ref: 'ABC123' })]);
  expect(legs).toEqual([
    expect.objectContaining({ mode: 'train', carrier: 'CP', depart_tz: expect.any(String) }),
  ]);
  expect(activities).toEqual([
    expect.objectContaining({ title: 'Museu do Azulejo', needs_booking: true, booked: true }),
  ]);
});
