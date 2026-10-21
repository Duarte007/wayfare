import { expect, test } from '../support/fixtures.ts';

test.describe('sign-in', () => {
  test('a wrong password is refused, the right one opens the trips list', async ({
    page,
    user,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel('E-mail').fill(user.email);
    await page.getByLabel('Senha', { exact: true }).fill('not the password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();

    await page.getByLabel('Senha', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qual é o próximo destino?' }),
    ).toBeVisible();
    await expect(page.getByText('Que bom te ver, Ana')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nenhuma viagem ainda' })).toBeVisible();
  });
});
