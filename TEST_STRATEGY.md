# TEST STRATEGY - Liverpool Search Flow

## Que no automatizar y por que

**Checkout y pagos:** Involucran datos sensibles, pasarelas de pago externas y riesgo de cargos reales. Deben cubrirse con contract tests contra las APIs de pago en entornos de staging, no a traves de la UI de produccion.

**Autenticacion con cuentas reales:** Riesgo de bloqueo de cuenta o activar deteccion de fraude. Cubrir con mocks o stubs a nivel de servicio.

**Widgets de terceros** (chat, loyalty, recomendaciones): Dependen de servicios externos fuera de nuestro control. Su inestabilidad genera falsos negativos en el pipeline.

**Precios exactos como oraculos absolutos:** Los precios y el stock cambian en tiempo real. Validar estructura y rangos, no valores exactos.

---

## Si Liverpool anadiera CAPTCHA

No combatir el CAPTCHA en E2E - es una senal de que se esta probando en la capa incorrecta.

1. Empujar cobertura de logica de negocio hacia unit y contract tests, que no pasan por el browser.
2. Solicitar un entorno de QA con CAPTCHA deshabilitado, es practica estandar en equipos maduros.
3. Si no existe ese entorno, interceptar el endpoint de busqueda con `page.route()` de Playwright para que el browser nunca emita la peticion real.
4. No usar servicios de resolucion de CAPTCHA en pipelines: son lentos, poco confiables y violan terminos de servicio.
5. En ultimo caso, realizar pausa controlada del test para solicitar la resolucion de forma manual del tester.

---

## Riesgos de flakiness y mitigaciones

| Riesgo | Mitigacion aplicada |
|--------|---------------------|
| Selectores dinamicos (DOM cambia en cada deploy) | Selectores semanticos (`role`, `aria-label`) y patrones de URL estables (`/tienda/pdp/`) en lugar de clases CSS |
| Race conditions tras filtro/sort | `waitForURL` + `Promise.all` en lugar de `waitForTimeout` fijo |
| Datos volatiles (precios, stock) | Aserciones tolerantes: threshold 3/5 en cross-validation; validar estructura, no valores exactos |
| Overlays de cookies bloqueando interacciones | Dismiss defensivo al inicio del test con `.catch()` para que su ausencia no rompa el flujo |
| Scripts de terceros que demoran la carga | `waitForLoadState('domcontentloaded')` en lugar de `networkidle` - evita bloquear en analytics/ads |
| Bot-protection (Akamai/CDN) bloqueando Chromium en CI | CI corre en Firefox; Chromium reservado para ejecucion local donde no hay rate-limiting |

---

## Integracion en CI con 50+ suites

**Etiquetar y aislar:** Marcar esta suite como `@smoke` para ejecutarse en cada PR, y `@regression` solo en runs nocturnos. No ejecutar todo en cada commit.

**Sharding en lugar de serializacion:** Usar `--shard=N/M` de Playwright para correr en paralelo con otras suites sin competir por un runner unico.

**Retries controlados:** `retries: 2` en CI (configurado en `playwright.config.ts`). Demasiados retries ocultan flakiness real. Alertar cuando un test consume su cuota de reintentos.

**Presupuesto de tiempo:** Esta suite debe completarse en menos de 90 segundos. Aplicar timeout a nivel de job en Actions, no solo a nivel de test.

**Path filters:** Omitir esta suite cuando los unicos cambios sean en docs, configs o codigo no relacionado con el frontend, usando filtros de rutas en GitHub Actions.