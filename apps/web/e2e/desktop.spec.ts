import { expect, test } from '@playwright/test';
import { collectErrors, freshStart, openTab } from './helpers';

test('rita → bana → simulera → exportera', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  const status = page.locator('footer [role=status]');
  const tree = page.locator('aside').first();

  // Rita en rektangel i vyn uppifrån.
  await openTab(page, 'Design');
  await page.getByRole('button', { name: 'Uppifrån' }).first().click();
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Rektangel' }).click();
  const view = page.locator('main');
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.55, { steps: 6 });
  await page.mouse.up();
  await expect(tree.getByText('Rektangel 2', { exact: true })).toBeVisible();

  // Profilbana på den nya rektangeln.
  await tree.getByText('Rektangel 2', { exact: true }).click();
  await openTab(page, 'Verktygsbanor');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Profil' }).click();
  await expect(status).toContainText('klar', { timeout: 30_000 });
  await expect(tree.getByText('1. Profil')).toBeVisible();

  // Simulera till slutet.
  await openTab(page, 'Simulera');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Resultat' }).click();
  await expect(status).toHaveText('Simulering klar', { timeout: 30_000 });
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Avsluta' }).click();

  // Exportera G-koden.
  await openTab(page, 'Export');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Spara G-kod' }).click();
  // Exportfönstret laddas när det öppnas – vänta på det innan Spara.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.locator('.btn-primary').last().click();
  const file = await download;
  const gcode = await (await file.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(file.suggestedFilename()).toMatch(/\.(nc|gcode|ngc|tap)$/);
  expect(gcode).toMatch(/G1 .*Z-/);
  expect(gcode).not.toMatch(/NaN|undefined/);

  expect(errors).toEqual([]);
});

test('senaste projekt och ångra överlever omladdning', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  const tree = page.locator('aside').first();
  await tree.getByText('Cirkel 1', { exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(tree.getByText('Cirkel 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ångra' }).first().click();
  await expect(tree.getByText('Cirkel 1', { exact: true })).toBeVisible();

  await openTab(page, 'Arkiv');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Senaste' }).click();
  await expect(page.getByRole('dialog').locator('li')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(tree.getByText('Kugghjul 1', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
