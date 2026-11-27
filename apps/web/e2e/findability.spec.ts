import { expect, test, type Page } from '@playwright/test';
import { collectErrors, freshStart } from './helpers';

const status = (page: Page) => page.locator('footer [role=status]');

test('kommandosök: ⌘K hittar och kör en funktion', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('combobox', { name: 'Sök funktion' });
  await expect(search).toBeFocused();
  // Utan accenter och med början av ordet.
  await page.keyboard.type('forskj');
  const hits = page.locator('#command-list').getByRole('option');
  await expect(hits.first()).toContainText('Förskjut kontur');
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  // Kör ett kommando med Enter: egna material öppnas och Inställning väljs.
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await page.keyboard.type('egna material');
  await expect(hits.first()).toContainText('Egna material');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Egna material' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Inställning', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('handbok: avsnitt och knappar som öppnar funktionen', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  await page.getByRole('button', { name: 'Handbok' }).first().click();
  const dlg = page.getByRole('dialog', { name: 'Handbok' });
  await expect(dlg.getByRole('heading', { name: 'Komma igång' })).toBeVisible();
  // Fräsen är vald – laseravsnittet säger att det gäller en annan maskin.
  await dlg.getByRole('button', { name: 'Laserskära och gravera' }).click();
  await expect(dlg).toContainText('annan maskintyp');
  await dlg.getByRole('button', { name: 'Fräsa' }).click();
  await dlg.getByRole('button', { name: /Profil|Kontur/ }).first().click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Verktygsbanor', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('enheter: tum visas och matas in, mm sparas internt', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  const toggle = page.locator('footer').getByRole('button', { name: /Växla mellan millimeter och tum/ });
  await expect(toggle).toHaveText('Metriskt (mm)');
  await toggle.click();
  await expect(page.locator('footer')).toContainText('Imperiskt (tum)');
  // Arbetsstyckets bredd 300 mm visas som 11,811 in.
  await page.getByRole('tab', { name: 'Inställning', exact: true }).click();
  const width = page.getByLabel('Bredd').first();
  await expect(width).toHaveValue(/^11[.,]81/);
  await width.fill('10');
  await width.press('Tab');
  // Tillbaka till mm: 10 in = 254 mm.
  await toggle.click();
  await expect(page.getByLabel('Bredd').first()).toHaveValue('254');
  await expect(status(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('gamla och ofullständiga projektfiler öppnas', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);
  // Filväljaren fångas av en lyssnare som registreras i förväg (annars hinner
  // webbläsarens egen dialog öppnas innan testet tar över).
  let next: { name: string; data: unknown } | null = null;
  page.on('filechooser', (c) => {
    if (next) void c.setFiles({ name: next.name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next.data)) });
  });
  await page.evaluate(() => 0);
  const open = async (name: string, data: unknown) => {
    next = { name, data };
    // Webbläsaren öppnar inte en ny filväljare direkt efter den förra.
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+o');
    await expect(status(page)).toBeVisible();
  };
  // Bara lager – inget material, inga verktyg eller banor.
  await open('minimal.dcam', { app: 'desktopCAM', version: 1, layers: [{ id: 'l1', shapes: [] }] });
  await expect(page.locator('aside').first()).toContainText('Namnlöst projekt');
  // Startprojektets former är borta – det tomma projektet är inläst.
  await expect(page.locator('aside').first()).toContainText('Rita en form');
  // Eget material följer med projektet.
  await open('eget.dcam', {
    app: 'desktopCAM',
    version: 1,
    layers: [],
    material: { presetId: 'custom-x', width: 200, height: 100, thickness: 6, zZero: 'top', origin: 'bottom-left' },
    customMaterials: [{ id: 'custom-x', name: 'Mitt testträ', category: 'wood', color: '#c0a080', defaultThickness: 6, custom: true, router: { feedRate: 1000, plungeRate: 300, spindleRpm: 12000, stepDownFactor: 0.5 } }],
  });
  await expect(page.locator('aside').first()).toContainText('Mitt testträ');
  // Ett material som inte finns (t.ex. från en annan dator) ger ett standardmaterial.
  await open('okant.dcam', { app: 'desktopCAM', version: 1, layers: [], material: { presetId: 'finns-inte', width: 100, height: 100, thickness: 5, zZero: 'top', origin: 'bottom-left' } });
  await expect(page.locator('aside').first()).toContainText('5 mm');
  expect(errors).toEqual([]);
});
