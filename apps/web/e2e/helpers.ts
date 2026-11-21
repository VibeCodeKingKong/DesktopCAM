import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Appens version – nyhetsrutan visas inte när den redan är sedd. */
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** Ny användare med svenska, utan välkomstfönster, rundtur och nyhetsruta. */
export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(async (version) => {
    localStorage.clear();
    await new Promise((r) => {
      const req = indexedDB.deleteDatabase('keyval-store');
      req.onsuccess = req.onerror = req.onblocked = r;
    });
    localStorage.setItem('desktopcam.lang', 'sv');
    localStorage.setItem('desktopcam.welcomeDone', '1');
    localStorage.setItem('desktopcam.tourDone', '1');
    localStorage.setItem('desktopcam.seenVersion', version);
  }, VERSION);
  await page.reload();
  await expect(page.locator('footer [role=status]')).toBeVisible();
}

/** Felsamlare: inga ohanterade fel i sidan under testet. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** Byter flik i bandet (ett klick på den valda fliken fäller annars ihop bandet). */
export async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true }).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(page.locator('[role=tabpanel]').first()).toBeVisible();
}
