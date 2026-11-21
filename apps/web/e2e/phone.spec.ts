import { expect, test } from '@playwright/test';
import { collectErrors, freshStart } from './helpers';

test('telefon: flikar, inställningsark, snabbknappar och egenskapsark', async ({ page }) => {
  const errors = collectErrors(page);
  await freshStart(page);

  // Flikraden längst ner och inställningsarket.
  const tabs = page.locator('nav[role=tablist]');
  await expect(tabs.getByRole('tab')).toHaveCount(6);
  await tabs.getByRole('tab', { name: 'Inställning' }).click();
  const setup = page.getByRole('dialog', { name: 'Inställning' });
  await expect(setup.getByLabel('Tjocklek')).toBeVisible();
  await setup.getByRole('button', { name: 'Stäng' }).click();

  // Markera via projektträdet, vrid med snabbknappen, öppna egenskapsarket.
  await page.getByRole('button', { name: 'Projekt' }).first().click();
  await page.getByText('Rektangel 1', { exact: true }).click();
  await page.locator('aside').first().getByRole('button', { name: 'Stäng' }).click();
  const quick = page.getByRole('toolbar');
  await quick.getByRole('button', { name: 'Rotera +15°' }).click();
  await quick.getByRole('button', { name: 'Egenskaper' }).click();
  const sheet = page.locator('aside[data-tour=panel-props]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'Placering' })).toBeVisible();

  // Mer-menyn.
  await page.getByRole('button', { name: 'Mer' }).click();
  await expect(page.getByRole('menu')).toContainText('Nybörjarläge');

  expect(errors).toEqual([]);
});
