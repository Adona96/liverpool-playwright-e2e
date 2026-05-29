import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Accessibility - search results page', async ({ page }) => {
  await page.goto('https://www.liverpool.com.mx/tienda/?s=playstation+5');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('a[href*="/tienda/pdp/"]').first().waitFor({ timeout: 30000 });

  const results = await new AxeBuilder({ page }).analyze();

  const bySeverity = (impact: string) => results.violations.filter(v => v.impact === impact);
  const critical = bySeverity('critical');
  const serious  = bySeverity('serious');
  const moderate = bySeverity('moderate');
  const minor    = bySeverity('minor');

  console.log('\n=== Accessibility Report - Search Results Page ===');
  console.log(`Critical: ${critical.length} | Serious: ${serious.length} | Moderate: ${moderate.length} | Minor: ${minor.length}`);

  results.violations.forEach(v => {
    console.log(`\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
    console.log(`  Nodes afectados: ${v.nodes.length}`);
    console.log(`  Referencia: ${v.helpUrl}`);
  });

  expect(critical, 'No debe haber violaciones de accesibilidad criticas').toHaveLength(0);
});