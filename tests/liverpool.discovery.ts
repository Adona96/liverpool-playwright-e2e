/**
 * ARCHIVO DE DESCUBRIMIENTO - Network Interception Investigation
 *
 * Este archivo documenta el proceso de investigacion para identificar como
 * Liverpool.com.mx expone los datos de productos en sus respuestas de red.
 * NO es un test de produccion. Sirve como historial del razonamiento y los
 * pasos que llevaron a la solucion final en liverpool.spec.ts.
 *
 * CONCLUSION FINAL:
 *   Liverpool usa Next.js con SSR. Los productos NO se cargan via AJAX/API JSON
 *   independiente - el sort es una navegacion completa (URL cambia a ?st=sortPrice|0).
 *   Los datos estructurados de productos estan disponibles en window.dataLayer
 *   (Google Tag Manager), que Liverpool popula con impresiones de productos al
 *   cargar cada pagina de resultados.
 */

import { test } from '@playwright/test';

test('[DISCOVERY] Identificar fuente de datos de productos en red', async ({ page }) => {

  // =========================================================================
  // INTENTO 1: waitForResponse con includes('search')
  // =========================================================================
  // Hipotesis: el sort dispara una llamada AJAX a una URL con 'search'.
  // Resultado: capturaba https://www.liverpool.com.mx/logBeaconsInfo?searchId=...
  //   porque el parametro ?searchId= contiene la palabra "search".
  //   La respuesta era HTML (<!DOCTYPE), no JSON -> SyntaxError al parsear.
  // Aprendizaje: includes() sobre la URL completa captura query params, no solo el path.
  // -------------------------------------------------------------------------
  // await Promise.all([
  //   page.waitForResponse(
  //     (resp) => resp.url().includes('search') && resp.status() === 200,
  //     { timeout: 30000 }
  //   ),
  //   page.evaluate(() => { /* click sort */ }),
  // ]);


  // =========================================================================
  // INTENTO 2: Agregar filtro de content-type application/json
  // =========================================================================
  // Hipotesis: si exigimos content-type JSON, evitamos capturar la pagina HTML.
  // Resultado: ahora si capturaba un JSON, pero era el beacon de analytics:
  //   https://www.liverpool.com.mx/logBeaconsInfo?searchId=...&sfEngine=google
  //   Este endpoint devuelve JSON vacio/minimo, no tiene productos.
  // Aprendizaje: logBeaconsInfo es un endpoint de tracking de Salesforce que
  //   responde JSON y cuya URL contiene "search" en su query string.
  // -------------------------------------------------------------------------
  // (resp) =>
  //   resp.url().includes('search') &&
  //   resp.status() === 200 &&
  //   (resp.headers()['content-type'] ?? '').includes('application/json')


  // =========================================================================
  // INTENTO 3: Listener amplio con startsWith('https://www.liverpool.com.mx')
  // =========================================================================
  // Hipotesis: capturando solo el dominio de Liverpool evitamos falsos positivos.
  // Resultado: seguia capturando logBeaconsInfo (su URL empieza con liverpool.com.mx)
  //   y los unicos JSON del dominio eran endpoints de header, footer, SEO, carrito.
  //   Ninguno tenia datos de productos.
  // Aprendizaje: el sort NO hace llamada AJAX - cambia la URL completa
  //   de /?s=playstation+5 a /?s=playstation+5&st=sortPrice%7C0 (navegacion SSR).
  // -------------------------------------------------------------------------
  // const responseCollector = (resp: any) => {
  //   const ct = resp.headers()['content-type'] ?? '';
  //   if (
  //     resp.status() === 200 &&
  //     ct.includes('application/json') &&
  //     resp.url().startsWith('https://www.liverpool.com.mx') &&
  //     !resp.url().includes('logBeacons')
  //   ) capturedUrls.push(resp.url());
  // };


  // =========================================================================
  // INTENTO 4: waitForNavigation -> waitForURL (pagina SSR)
  // =========================================================================
  // Una vez confirmado que el sort hace navegacion completa, usamos waitForURL
  // para esperar que la URL cambie al patron correcto antes de extraer.
  // waitForNavigation estaba deprecated en Playwright moderno.
  // Usamos /st=sortPrice/ como regex para confirmar la URL del sort.
  // -------------------------------------------------------------------------
  // await Promise.all([
  //   page.waitForURL(/st=sortPrice/, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  //   page.evaluate(() => { /* click sort */ }),
  // ]);


  // =========================================================================
  // INTENTO 5: Listener global sin filtro de dominio
  // =========================================================================
  // Hipotesis: los productos quiza vienen de un dominio externo (CDN, Salesforce).
  // Resultado: dominios capturados:
  //   - www.liverpool.com.mx        -> header, footer, SEO, carrito, /api/jewel
  //   - apicms.liverpool.com.mx     -> megamenu, typeahead (autocompletado)
  //   - ingest.quantummetric.com    -> analytics de sesion (falsos positivos)
  //   - serviciosliverpoolsadecv... -> Evergage personalizacion
  //   - svc-prod-us.liveshopping... -> Bambuser live shopping widget
  //   - liverpoolapp.firebaseapp.com -> configuracion Firebase
  //   - us.creativecdn.com          -> CDN creatives/ads
  //   NINGUNO devuelve datos de productos.
  // Aprendizaje: Liverpool renderiza los productos server-side en el HTML.
  //   No existe una API JSON separada para el listado de productos PLP.
  // -------------------------------------------------------------------------
  // capturedUrls.forEach(url => console.log(' -', url.substring(0, 120)));


  // =========================================================================
  // INTENTO 6: Explorar __NEXT_DATA__ (Liverpool usa Next.js)
  // =========================================================================
  // Hipotesis: Next.js inyecta los datos SSR en <script id="__NEXT_DATA__">.
  // Resultado:
  //   page: /tienda/twoColumnCategoryPage
  //   pageProps keys: ['body', 'flags', 'data']
  //   data: { siteCssfileName: 'liverpool', AssetsPath: '...' } -> solo config CSS
  //   body: {} (objeto vacio)
  //   flags: feature flags (GTM, chatbot, auth0, etc.) -> no hay productos
  // Aprendizaje: Liverpool usa Next.js como shell/wrapper pero los productos
  //   se renderizan via componentes hidratados client-side, no en getServerSideProps.
  //   __NEXT_DATA__ solo contiene configuracion de la pagina, no productos.
  // -------------------------------------------------------------------------
  // const nextDataInfo = await page.evaluate(() => {
  //   const nextScript = document.getElementById('__NEXT_DATA__')?.textContent;
  //   const data = JSON.parse(nextScript!);
  //   return {
  //     page:          data.page,
  //     pagePropsKeys: Object.keys(data?.props?.pageProps ?? {}),
  //     bodyPreview:   JSON.stringify(data?.props?.pageProps?.body)?.substring(0, 300),
  //     flagsKeys:     Object.keys(data?.props?.pageProps?.flags ?? {}),
  //   };
  // });


  // =========================================================================
  // SOLUCION FINAL: window.dataLayer (Google Tag Manager)
  // =========================================================================
  // Hipotesis: Liverpool usa GTM para analytics de e-commerce. GTM popula
  //   window.dataLayer con eventos de impresion de productos al cargar el PLP.
  //   Este dataLayer es la fuente estructurada de datos mas confiable disponible
  //   en el contexto del browser, y refleja exactamente lo que el servidor entrego.
  //
  // Estructura encontrada en cada item:
  //   {
  //     id:          "1180626294",          // SKU del producto
  //     name:        "Consola fija ps5...", // nombre del producto
  //     brand:       "PLAYSTATION",         // marca
  //     price:       "8998.73",             // precio de venta actual
  //     metric2:     "11599.00",            // precio original (antes de descuento)
  //     position:    "1",                   // posicion en los resultados
  //     list:        "searchResults-playstation 5|principal"
  //   }
  //
  // Ventajas sobre otras fuentes:
  //   - Siempre disponible en paginas de resultados (requisito de GTM e-commerce)
  //   - Contiene precio original y precio de descuento (metric2 vs price)
  //   - Es la misma fuente que usa el equipo de analytics -> datos canonicos
  //   - No requiere interceptar ni parsear respuestas de red complejas
  //
  // Implementacion final en liverpool.spec.ts
  // -------------------------------------------------------------------------

  await page.goto('https://www.liverpool.com.mx/tienda');
  await page.waitForLoadState('domcontentloaded');

  const acceptBtn = page.getByRole('button', { name: /aceptar|accept/i });
  if (await acceptBtn.count()) await acceptBtn.click().catch(() => {});

  const searchInput = page.locator('input[placeholder*="Buscar"], input[aria-label*="Buscar"], input[type="search"]').first();
  await searchInput.fill('playstation 5');
  await searchInput.press('Enter');
  await page.locator('a[href*="/tienda/pdp/"]').first().waitFor({ timeout: 30000 });

  const colorFilter = page.locator('div.newCategoriesChipsCarrousel div.newPlpChip:has-text("Blanco")').first();
  await colorFilter.waitFor({ state: 'visible', timeout: 20000 });
  await colorFilter.click();
  await page.locator('figcaption.a-plp-product-info').first().waitFor({ timeout: 20000 });

  const sortToggle = page.getByRole('link', { name: /Ordenar por:/i }).first();
  await sortToggle.waitFor({ state: 'visible', timeout: 20000 });
  await sortToggle.scrollIntoViewIfNeeded();
  await sortToggle.click({ timeout: 10000 });

  await Promise.all([
    page.waitForURL(/st=sortPrice/, { waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>('div.dropdown-menu.show[aria-labelledby="sortby"] button.dropdown-item[datahref*="sortPrice|0"]');
      if (btn) btn.click();
    }),
  ]);

  // Verificar dataLayer - fuente final confirmada
  const dataLayerSample = await page.evaluate(() => {
    const dl = (window as any).dataLayer ?? [];
    const impressions: any[] = dl.flatMap((e: any) =>
      e?.ecommerce?.impressions ?? e?.ecommerce?.items ?? []
    );
    return {
      total:  impressions.length,
      sample: impressions.slice(0, 2),
      keys:   impressions[0] ? Object.keys(impressions[0]) : [],
    };
  });

  console.log('[DISCOVERY] dataLayer total productos:', dataLayerSample.total);
  console.log('[DISCOVERY] dataLayer keys:', dataLayerSample.keys);
  console.log('[DISCOVERY] dataLayer sample:', JSON.stringify(dataLayerSample.sample, null, 2));
});