import { test, expect } from '@playwright/test';

test('Visual regression - search results page', async ({ page }) => {
  test.skip(!!process.env.CI, 'Visual baselines require --update-snapshots before running in CI');
  test.setTimeout(120_000);

  await page.goto('https://www.liverpool.com.mx/tienda');

  const acceptBtn = page.getByRole('button', { name: /aceptar|accept/i });
  if (await acceptBtn.count()) await acceptBtn.click().catch(() => {});

  const searchInput = page.locator('input[placeholder*="Buscar"], input[aria-label*="Buscar"], input[type="search"]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 60000 });
  await searchInput.fill('playstation 5');
  await searchInput.press('Enter');
  await page.locator('a[href*="/tienda/pdp/"]').first().waitFor({ timeout: 30000 });

  await expect(page).toHaveScreenshot('search-results.png', {
    maxDiffPixelRatio: 0.05,
    fullPage: false,
  });
});