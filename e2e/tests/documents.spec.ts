import { backend } from '../support/backend.ts';
import { expect, expectSynced, signInWithSession, test } from '../support/fixtures.ts';
import { plannedTrip } from '../support/seed.ts';

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

test('a document saved on the device is uploaded to storage', async ({ page, context, user }) => {
  const { tripId, rows } = plannedTrip(user.id);
  await backend.seed(user.id, rows);
  await signInWithSession(context, user);
  await page.goto(`/trips/${tripId}/documents`);
  await expect(page.getByRole('heading', { level: 1, name: 'Documentos' })).toBeVisible();

  await page.locator('input[type=file]').setInputFiles({
    name: 'cartao-de-embarque-TP1234.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Título')).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Salvar documento' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('listitem').filter({ hasText: /TP1234/i })).toBeVisible();

  await expectSynced(page);
  const [document] = await backend.rows(user.id, 'documents');
  expect(document).toMatchObject({
    trip_id: tripId,
    mime: 'application/pdf',
    size_bytes: PDF.length,
  });
  await expect
    .poll(() => backend.files(user.id))
    .toEqual([
      { key: `documents/${document!.storage_path}`, type: 'application/pdf', size: PDF.length },
    ]);
});
