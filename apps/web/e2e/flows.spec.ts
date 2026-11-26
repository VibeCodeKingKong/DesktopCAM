import { expect, test, type Page } from '@playwright/test';
import { collectErrors, freshStart, openTab } from './helpers';

/** Byter maskin under Inställning (första listan är maskinvalet). */
async function selectMachine(page: Page, id: string) {
  await openTab(page, 'Inställning');
  await page.locator('[role=tabpanel] select').first().selectOption(id);
}
const status = (page: Page) => page.locator('footer [role=status]');
const tree = (page: Page) => page.locator('aside').first();

test('laser: skärning med mikrobryggor och simulering', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await selectMachine(page, 'creality-falcon2-22w');
  await tree(page).getByText('Rektangel 1', { exact: true }).click();
  await openTab(page, 'Verktygsbanor');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Laser' }).first().click();
  await expect(status(page)).toContainText('klar', { timeout: 30_000 });
  await page.getByRole('switch', { name: 'Håll kvar delarna' }).click();
  await expect(page.getByLabel('Antal per del')).toHaveValue('3');
  // Banan räknas om en kort stund efter ändringen – vänta in den nya G-koden.
  await expect(status(page)).toContainText('Beräknar', { timeout: 5_000 }).catch(() => undefined);
  await expect(status(page)).toContainText('klar', { timeout: 30_000 });
  await page.waitForTimeout(500);
  await openTab(page, 'Simulera');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Resultat' }).click();
  await expect(status(page)).toContainText('Simulering klar', { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('plasma: skärning, utplacering på skivan och arbetsblad', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await selectMachine(page, 'langmuir-crossfire-pro');
  await tree(page).getByText('Kugghjul 1', { exact: true }).click();
  await openTab(page, 'Verktygsbanor');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Plasma' }).first().click();
  await expect(status(page)).toContainText('klar', { timeout: 30_000 });
  // Två kugghjul på skivan – kopian får samma bana.
  await tree(page).getByText('Kugghjul 1', { exact: true }).click();
  await openTab(page, 'Design');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Justera' }).click();
  await page.locator('button').filter({ hasText: 'Placera ut på skivan' }).last().click();
  const nest = page.getByRole('dialog');
  await nest.getByLabel('Antal av varje').fill('2');
  await nest.getByLabel('Antal av varje').blur();
  await expect(nest.getByRole('status')).toContainText('2 delar');
  await nest.getByRole('button', { name: 'Placera ut' }).click();
  await expect(tree(page).getByText('Kugghjul 1 2', { exact: true })).toBeVisible();
  // Arbetsbladet listar banan.
  await expect(status(page)).toContainText(/klar|utplacerade/, { timeout: 30_000 });
  await openTab(page, 'Export');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Arbetsblad' }).click();
  await expect(page.getByRole('dialog')).toContainText('Plasmaskärning', { timeout: 30_000 });
  await expect(page.getByRole('dialog')).toContainText('Total tid');
  expect(errors).toEqual([]);
});

test('fräs: inlägg (ficka och plugg) och relief', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await tree(page).getByText('Cirkel 1', { exact: true }).click();
  await openTab(page, 'Verktygsbanor');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Inlägg' }).first().click();
  await expect(tree(page).getByText(/Inlägg – ficka/)).toBeVisible();
  await expect(tree(page).getByText(/Inlägg – plugg/)).toBeVisible();
  // Relief ur biblioteket och en 3D-bana.
  await openTab(page, 'Design');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Reliefbibliotek' }).click();
  await page.getByRole('dialog').getByRole('listbox').getByRole('option').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lägg till i projektet' }).click();
  await openTab(page, 'Verktygsbanor');
  await page.locator('[role=tabpanel] button').filter({ hasText: '3D-relief' }).click();
  await expect(tree(page).getByText(/Relief/).first()).toBeVisible();
  await expect(status(page)).toContainText('klar', { timeout: 90_000 });
  expect(errors).toEqual([]);
});

test('eget material skapas och väljs', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await openTab(page, 'Inställning');
  await page.locator('[role=tabpanel] button').filter({ hasText: 'Material' }).last().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Nytt material' }).click();
  await dlg.getByLabel('Namn').fill('Testek');
  await dlg.getByRole('button', { name: 'Spara och använd' }).click();
  await expect(tree(page).getByText(/Testek/)).toBeVisible();
  expect(errors).toEqual([]);
});
