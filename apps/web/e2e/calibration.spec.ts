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
