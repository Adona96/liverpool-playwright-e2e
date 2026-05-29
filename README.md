# Liverpool Playwright E2E

Proyecto de prueba técnica: automatiza búsqueda en Liverpool, intercepta respuesta y valida datos.

Requisitos:
- Node.js 18+

Instalación:

```bash
npm install
```

> En Windows, si PowerShell bloquea `npm` o `npx`, ejecuta los comandos desde `cmd.exe`.
>
> Ejemplo:
>
> ```bash
> cmd /c "npm install"
> ```
>
> El script `prepare` instala los navegadores Playwright automáticamente durante `npm install`.
>
> Si necesitas forzar la instalación de navegadores, ejecuta:
>
> ```bash
> npm run install-browsers
> ```
>
> Esto es útil si `npm test` falla antes de iniciar los tests.
>
> o desde `cmd.exe`:
>
> ```bash
> cmd /c "npx playwright install --with-deps"
> ```
>
Run tests (headless by default):

```bash
npm test
```

Run headed (open browser):

```bash
npm run test:headed
```

Run CI-style tests:

```bash
npm run test:ci
```

Resultados:
- El reporte HTML se genera en `playwright-report`.
