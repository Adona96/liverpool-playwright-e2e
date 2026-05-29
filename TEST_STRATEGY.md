# TEST STRATEGY — Liverpool Search Flow

## Qué no automatizar y por qué

**Checkout y pagos:** Involucran datos sensibles, pasarelas de pago externas y riesgo de cargos reales. Deben cubrirse con contract tests contra las APIs de pago en entornos de staging, no a través de la UI de producción.

**Autenticación con cuentas reales:** Riesgo de bloqueo de cuenta o activar detección de fraude. Cubrir con mocks o stubs a nivel de servicio.

**Widgets de terceros** (chat, loyalty, recomendaciones): Dependen de servicios externos fuera de nuestro control. Su inestabilidad genera falsos negativos en el pipeline.

**Precios exactos como oráculos absolutos:** Los precios y el stock cambian en tiempo real. Validar estructura y rangos, no valores exactos.

---

## Si Liverpool añadiera CAPTCHA

No combatir el CAPTCHA en E2E — es una señal de que se está probando en la capa incorrecta.

1. Empujar cobertura de lógica de negocio hacia unit y contract tests, que no pasan por el browser.
2. Solicitar un entorno de QA con CAPTCHA deshabilitado, es práctica estándar en equipos maduros.
3. Si no existe ese entorno, interceptar el endpoint de búsqueda con `page.route()` de Playwright para que el browser nunca emita la petición real.
4. No usar servicios de resolución de CAPTCHA en pipelines: son lentos, poco confiables y violan términos de servicio.
5. En ultimo caso, realizar pasusa controlada del test para solicitar la resolución de forma manual del tester.

---

## Riesgos de flakiness y mitigaciones

| Riesgo | Mitigación aplicada |
|--------|---------------------|
| Selectores dinámicos (DOM cambia en cada deploy) | Selectores semánticos (`role`, `aria-label`) y patrones de URL estables (`/tienda/pdp/`) en lugar de clases CSS |

| Race conditions tras filtro/sort | Esperar respuesta de red (`waitForResponse`) en lugar de `waitForTimeout` fijo |

| Datos volátiles (precios, stock) | Aserciones tolerantes: validar estructura, no valores exactos |

| Overlays de cookies bloqueando interacciones | Dismiss defensivo al inicio del test con `.catch()` para que su ausencia no rompa el flujo |

| Scripts de terceros que demoran la carga | `waitForLoadState('domcontentloaded')` en lugar de `networkidle` — evita bloquear en analytics/ads |

---

## Integración en CI con 50+ suites

**Etiquetar y aislar:** Marcar esta suite como `@smoke` para ejecutarse en cada PR, y `@regression` solo en runs nocturnos. No ejecutar todo en cada commit.

**Sharding en lugar de serialización:** Usar `--shard=N/M` de Playwright para correr en paralelo con otras suites sin competir por un runner único.

**Retries controlados:** `retries: 1` en CI, no 3+. Demasiados retries ocultan flakiness real. Alertar cuando un test consume su cuota de reintentos.

**Presupuesto de tiempo:** Esta suite debe completarse en menos de X segundos. Aplicar timeout a nivel de job en Actions, no solo a nivel de test.

**Path filters:** Omitir esta suite cuando los únicos cambios sean en docs, configs o código no relacionado con el frontend, usando filtros de rutas en GitHub Actions.
