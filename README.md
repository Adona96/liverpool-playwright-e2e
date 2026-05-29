# Liverpool Playwright E2E

[![Tests](https://github.com/Adona96/liverpool-playwright-e2e/actions/workflows/test.yml/badge.svg)](https://github.com/Adona96/liverpool-playwright-e2e/actions/workflows/test.yml)

Prueba técnica: suite de automatización E2E para Liverpool.com.mx usando Playwright + TypeScript.

Cubre búsqueda de productos, filtrado por color, ordenamiento por precio, validación contra `window.dataLayer` (GTM), accesibilidad con axe-core y regresión visual.

---

## Requisitos

- Node.js 18+
- Git

---

## Instalación

```bash
git clone https://github.com/Adona96/liverpool-playwright-e2e.git
cd liverpool-playwright-e2e
npm install
```

> `npm install` instala las dependencias y los browsers de Playwright automáticamente via el script `prepare`.
>
> En Windows, si PowerShell bloquea `npm`, ejecuta desde `cmd.exe`:
> ```bash
> cmd /c "npm install"
> ```

---

## Ejecución

### Todos los tests

```bash
# Headless (por defecto)
npm test

# Con browser visible
npm run test:headed
```

### Tests individuales

```bash
# Flujo principal — búsqueda, filtro, sort, validación (headless)
npm run test:main

# Flujo principal — con browser visible
npm run test:main:headed

# Accesibilidad con axe-core (headless)
npm run test:a11y

# Regresión visual — genera/compara screenshots (headless)
npm run test:visual
```

### Ver el reporte HTML

```bash
npm run report
```

---

## Headless vs Headed

| Modo | Comando | Descripción |
|------|---------|-------------|
| Headless | `npm test` | Sin ventana de browser, ideal para CI |
| Headed | `npm run test:headed` | Browser visible, útil para depuración |
| Headed (solo main) | `npm run test:main:headed` | Solo el flujo principal con browser visible |

---

## Regresión Visual

La primera vez que corras el test visual necesitas generar el **baseline**:

```bash
npx playwright test liverpool.visual --project=chromium --update-snapshots
```

Las ejecuciones siguientes comparan automáticamente contra ese baseline.

> **Nota:** El test visual puede devolver "Access Denied" si Liverpool detecta múltiples peticiones automatizadas en poco tiempo (protección Akamai/CDN). En ese caso, espera unos minutos antes de reintentar o ejecútalo como parte del suite completo con `npm test`. En un entorno de staging sin bot-protection, este test funciona sin restricciones.

---

## Data-driven

Los casos de prueba se leen desde [`test-data/search-tests.csv`](test-data/search-tests.csv):

```csv
searchTerm,colorFilter,sortOrder
playstation 5,Blanco,price_asc
xbox series x,Negro,price_asc
nintendo switch,Rojo,price_asc
```

Para agregar un caso nuevo basta con agregar una fila al CSV. Los valores válidos para `sortOrder` son `price_asc` y `price_desc`.

---

## CI/CD

El pipeline de GitHub Actions corre automáticamente en cada push o pull request a `main`.

**[Ver pipeline](https://github.com/Adona96/liverpool-playwright-e2e/actions/workflows/test.yml)**

Pasos:
1. Instala dependencias con `npm ci`
2. Instala browsers de Playwright con `--with-deps`
3. Ejecuta los tests en headless
4. Sube el reporte HTML como artefacto descargable

---

## Estructura del proyecto

```
liverpool-playwright-e2e/
├── .github/workflows/test.yml       # Pipeline CI/CD
├── test-data/
│   └── search-tests.csv             # Casos de prueba data-driven
├── tests/
│   ├── liverpool.spec.ts            # Test principal (E2E + validación)
│   ├── liverpool.a11y.spec.ts       # Accesibilidad con axe-core
│   ├── liverpool.visual.spec.ts     # Regresión visual
│   └── liverpool.discovery.ts      # Historial investigación de red
├── playwright.config.ts             # Configuración Playwright
├── package.json                     # Scripts y dependencias
├── TEST_STRATEGY.md                 # Estrategia de pruebas
└── tsconfig.json                    # Configuración TypeScript
```