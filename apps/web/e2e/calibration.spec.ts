import { expect, test } from '@playwright/test';
import { collectErrors, freshStart, openTab } from './helpers';

test('kalibrering: fräsprov → kontrollerad G-kod → mätning → historik', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await openTab(page, 'Inställning');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Kalibrering' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: 'Fräs' }).click();
  await dlg.getByRole('option', { name: 'Måttnoggrannhet' }).click();

  await dlg.getByRole('button', { name: /Skapa och kontrollera G-kod/ }).click();
  await expect(dlg.getByText(/Kontrollerad:/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Spara G-kod' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.gcode$/);

  // Mät: fickan blev 30,2 mm → fräsen skär bredare än sin diameter.
  await dlg.getByLabel('B ficka, X (30)').fill('30.2');
  await dlg.getByLabel('B ficka, Y (30)').fill('30.2');
  await dlg.getByRole('button', { name: 'Spara provet' }).click();
  await dlg.getByRole('tab', { name: 'Historik' }).click();
  await expect(dlg.getByText('Måttnoggrannhet').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('kalibrering: provet läggs in i projektet och simuleras', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await openTab(page, 'Inställning');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Kalibrering' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('tab', { name: 'Fräs' }).click();
  await dlg.getByRole('option', { name: 'Måttnoggrannhet' }).click();
  // Förklaring med "i" och uppspelning av provet.
  await dlg.getByRole('button', { name: 'Mer om Djup' }).click();
  await expect(page.getByRole('dialog', { name: 'Djup' })).toBeVisible();
  await page.keyboard.press('Escape');
  await dlg.getByRole('button', { name: 'Spela upp' }).click();
  await expect(dlg.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await dlg.getByRole('button', { name: /Skapa och kontrollera G-kod/ }).click();
  await dlg.getByRole('button', { name: 'Simulera' }).click();
  await expect(page.locator('footer [role=status]')).toContainText('simuleringen är öppen');
  await expect(page.locator('aside').first().getByText('1. Måttnoggrannhet')).toBeVisible();
  expect(errors).toEqual([]);
});

test('G-kod kan importeras som verktygsbana', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await openTab(page, 'Design');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[role=tabpanel] button').filter({ hasText: 'G-kod' }).click()]);
  await chooser.setFiles({ name: 'prov.nc', mimeType: 'text/plain', buffer: Buffer.from('G21 G90\nG0 Z5\nG0 X10 Y10\nG1 Z-1 F300\nG1 X60 F800\nG1 Y40\nG1 X10\nG1 Y10\nG0 Z5\nM2\n') });
  await expect(page.locator('footer [role=status]')).toContainText('prov.nc är importerad');
  await expect(page.locator('aside').first().getByText('1. prov')).toBeVisible();
  expect(errors).toEqual([]);
});
