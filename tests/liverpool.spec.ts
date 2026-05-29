import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Test data — read from CSV so cases can be changed without touching test code
// ---------------------------------------------------------------------------
const csvPath = path.join(__dirname, '..', 'test-data', 'search-tests.csv');
const testCases = fs
  .readFileSync(csvPath, 'utf-8')
  .trim()
  .split('\n')
  .slice(1) // skip header row
  .map(line => {
    const [searchTerm, colorFilter, sortOrder] = line.split(',').map(v => v.trim());
    return { searchTerm, colorFilter, sortOrder };
  });

// Maps human-readable sort keys (used in CSV) to Liverpool's technical values
const SORT_MAP: Record<string, { datahref: string; label: string }> = {
  price_asc:  { datahref: 'sortPrice|0', label: 'Menor precio' },
  price_desc: { datahref: 'sortPrice|1', label: 'Mayor precio' },
};

// ---------------------------------------------------------------------------
// Data-driven test — one test per CSV row
// ---------------------------------------------------------------------------
testCases.forEach(({ searchTerm, colorFilter, sortOrder }) => {
  test(`[${searchTerm}] filtro: ${colorFilter} | orden: ${sortOrder}`, async ({ page }) => {
    const sort = SORT_MAP[sortOrder];
    const sortUrlPattern = new RegExp('st=' + sort.datahref.replace(/\|/g, '\\|'));

    // Navigate
    await page.goto('https://www.liverpool.com.mx/tienda');
    await page.waitForLoadState('domcontentloaded');

    // Close cookies banner
    const acceptBtn = page.getByRole('button', { name: /aceptar|accept/i });
    if (await acceptBtn.count()) await acceptBtn.click().catch(() => {});

    // Find and fill search input
    const searchInput = page.locator('input[placeholder*="Buscar"], input[aria-label*="Buscar"], input[type="search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await searchInput.fill(searchTerm);

    // Submit search and assert results load within 10 seconds
    await searchInput.press('Enter');
    const searchStart = Date.now();
    await page.locator('a[href*="/tienda/pdp/"]').first().waitFor({ timeout: 30000 });
    const searchLoadTime = Date.now() - searchStart;
    console.log(`[PERF] Resultados de busqueda cargados en ${searchLoadTime}ms`);
    expect(searchLoadTime, 'Search results must load in under 10 seconds').toBeLessThan(10_000);

    // Apply color filter
    const colorFilterEl = page.locator(`div.newCategoriesChipsCarrousel div.newPlpChip:has-text("${colorFilter}")`).first();
    await colorFilterEl.waitFor({ state: 'visible', timeout: 20000 });
    await colorFilterEl.click();
    await page.locator('figcaption.a-plp-product-info').first().waitFor({ timeout: 20000 });

    // Sort by price - Liverpool PLP uses full-page navigation for sort
    const sortToggle = page.getByRole('link', { name: /Ordenar por:/i }).first();
    await sortToggle.waitFor({ state: 'visible', timeout: 20000 });
    await sortToggle.scrollIntoViewIfNeeded();
    await sortToggle.click({ timeout: 10000 });

    await Promise.all([
      page.waitForURL(sortUrlPattern, { waitUntil: 'domcontentloaded', timeout: 30000 }),
      page.evaluate((datahref) => {
        const btn = document.querySelector<HTMLElement>(
          `div.dropdown-menu.show[aria-labelledby="sortby"] button.dropdown-item[datahref*="${datahref}"]`
        );
        if (btn) btn.click();
      }, sort.datahref),
    ]);

    await page.locator('figcaption.a-plp-product-info').first().waitFor({ timeout: 30000 });

    // Extract name, description, original price and final price of first 5 visible results
    await page.evaluate(() => window.scrollTo(0, 0));

    const uiProducts = await page.$$eval(
      'figcaption.a-plp-product-info',
      (cards) =>
        cards
          .filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top >= 0;
          })
          .slice(0, 5)
          .map((card) => {
            const brand       = card.querySelector('h3.a-card-brand')?.textContent?.trim() ?? '';
            const description = card.querySelector('h3.a-card-description')?.textContent?.trim() ?? '';
            const name        = [brand, description].filter(Boolean).join(' - ');

            const toPrice = (el: Element | null): string => {
              if (!el) return '';
              const cents = (el.querySelector('sup')?.textContent ?? '').trim();
              const clone = el.cloneNode(true) as Element;
              clone.querySelector('sup')?.remove();
              const main  = clone.textContent?.trim() ?? '';
              return cents ? `${main}.${cents}` : main;
            };

            return {
              name,
              originalPrice: toPrice(card.querySelector('p.a-card-price')),
              finalPrice:    toPrice(card.querySelector('p.a-card-discount')),
            };
          })
    );

    console.log(`\n=== [${searchTerm}] filtro: ${colorFilter} | orden: ${sort.label} ===`);
    uiProducts.forEach((p, i) => {
      const priceMsg = p.finalPrice
        ? `con un costo de ${p.originalPrice} rebajado a un total de ${p.finalPrice}`
        : `con un costo de ${p.originalPrice}`;
      console.log(`${i + 1}. ${p.name} - ${priceMsg}`);
    });

    // Get structured product data from window.dataLayer (populated by GTM on page load).
    // Liverpool populates dataLayer with product impression data on every PLP render,
    // making it the canonical structured source for cross-validation.
    const apiProducts = await page.evaluate(() => {
      const dl = (window as any).dataLayer ?? [];
      const impressions: any[] = dl.flatMap((e: any) =>
        e?.ecommerce?.impressions ?? e?.ecommerce?.items ?? []
      );
      return impressions.map((p: any) => ({
        id:            String(p.id ?? ''),
        name:          String(p.name ?? '').trim().toLowerCase(),
        brand:         String(p.brand ?? '').trim().toLowerCase(),
        price:         String(p.price ?? ''),
        originalPrice: String(p.metric2 ?? p.price ?? ''),
      }));
    });

    console.log(`\n[API] Total productos en dataLayer: ${apiProducts.length}`);

    // Cross-validate UI results vs dataLayer
    console.log('\n=== Validacion UI vs dataLayer ===');
    let matches = 0;

    uiProducts.forEach((uiProduct) => {
      const [uiBrand, ...rest] = uiProduct.name.split(' - ');
      const uiDesc   = rest.join(' - ').toLowerCase();
      const uiBrandL = uiBrand.toLowerCase();

      const match = apiProducts.find((ap: { name: string; brand: string; price: string; originalPrice: string }) => {
        const brandOk = uiBrandL.includes(ap.brand) || ap.brand.includes(uiBrandL);
        const nameOk  = uiDesc.split(' ')
          .filter((w: string) => w.length > 4)
          .some((w: string) => ap.name.includes(w));
        return brandOk && nameOk;
      });

      if (match) {
        matches++;
        const uiFinal    = uiProduct.finalPrice.replace(/[$,]/g, '');
        const uiOriginal = uiProduct.originalPrice.replace(/[$,]/g, '');
        const priceOk    = uiFinal === match.price || uiOriginal === match.originalPrice;

        if (!priceOk) {
          console.log(`[DISCREPANCIA PRECIO] "${uiProduct.name}"`);
          console.log(`  UI:  original=${uiProduct.originalPrice} | final=${uiProduct.finalPrice}`);
          console.log(`  API: original=$${match.originalPrice}   | final=$${match.price}`);
        } else {
          console.log(`[OK] "${uiProduct.name}"`);
        }
      } else {
        console.log(`[NO ENCONTRADO] "${uiProduct.name}"`);
      }
    });

    console.log(`\nCoincidencias: ${matches}/5 (minimo requerido: 3)`);
    expect(matches).toBeGreaterThanOrEqual(3);
  });
});