# E2E Facturar Critical Flow Runbook

Fecha de estabilización: 2026-04-28

Este documento conserva el diagnóstico y las decisiones tomadas para estabilizar el flujo E2E real de Facturar. Se deja aquí porque el arreglo fue laborioso y mezcla producto, backend real, Playwright, Vite, Node y particularidades de macOS en un volumen RAID.

## Flujo protegido

Test crítico:

```bash
e2e/critical-flows.spec.ts
```

Caso:

```text
Facturar: crear, guardar, recargar y editar
```

Contrato que protege:

1. Autenticar con token real.
2. Abrir `/facturar` en frontend local.
3. Cargar configuración real del backend.
4. Crear documento facturable con perfil, cliente, número y línea.
5. Guardar vía `POST /api/documents`.
6. Exigir respuesta OK y `recordId`.
7. Recargar por `recordId`.
8. Editar concepto.
9. Guardar de nuevo y confirmar que el cambio se envía.

No debe haber `skip` silencioso ni falsos positivos.

## Smoke Gastos (backend real)

Archivo: `e2e/expenses-flow.spec.ts`.

Caso:

```text
Gastos: smoke crear, guardar, editar y archivar
```

Resumen:

1. Misma autenticación (bearer) y **reenvío de `/api/**`** que Facturar, extraído a `e2e/browserApiHarness.ts` (`bootstrapAuthInBrowser`, `fetchApiJson`, cumplimiento JSON de `/api/config` en navegador).
2. En Node: `GET /api/expense-options` debe exponer `vendors` y `categories` como arrays (raíz, `expenseOptions` o `data`, coherente con `e2e/global-setup.ts`).
3. UI `/gastos`: marcador único `E2E-GASTO-<timestamp>`, perfil desde `/api/config`, fecha, proveedor, descripción, base.
4. Dos `POST /api/expenses` con `response.ok()`, mismo `recordId` en la edición; si la respuesta incluye `expense.description`, debe coincidir con el texto editado.
5. **Limpieza:** `POST /api/expenses/archive` con bearer. Si falla, el test **falla** con mensaje explícito (el gasto E2E puede quedar en el sistema).

## Dónde ejecutar los comandos

Los tests viven en el paquete **`facturacion-react`**. La mayoría de comandos asumen **directorio de trabajo** `…/facturacion/facturacion-react/`:

```bash
cd facturacion-react
npm run test:e2e
```

Desde la **raíz del monorepo** `facturacion/` (junto a `server.mjs`), el `package.json` raíz puede delegar con `npm run test:e2e` si existe el script que llama a `--prefix ./facturacion-react`. Si ejecutas `npm run test:e2e` solo en una carpeta sin ese script, verás `Missing script: "test:e2e"`.

## Entorno esperado

Frontend local:

```text
http://127.0.0.1:4173
```

Backend real:

```text
https://facturacion.pearandco.es
```

Variables E2E:

```text
.env.e2e
E2E_API_TARGET=https://facturacion.pearandco.es
E2E_USER_TOKEN
```

También se soporta login con:

```text
E2E_USER_EMAIL
E2E_USER_PASSWORD
```

## Comandos canónicos

Ejecutar desde **`facturacion-react/`** (salvo que uses el script delegado en la raíz del monorepo).

Primera vez o tras actualizar Playwright:

```bash
npx playwright install chromium
```

El proyecto **`setup`** (`e2e/auth.setup.ts`) debe pasar antes de **`chromium`**; `playwright.config.ts` ya declara esa dependencia. Si cambias el init script de auth o el wizard, conviene regenerar estado:

```bash
rm -rf e2e/.auth && npm run test:e2e
```

Validación rápida del flujo crítico:

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test e2e/critical-flows.spec.ts --project=chromium --workers=1
```

Validación E2E completa del repo:

```bash
npm run test:e2e
```

Validaciones de cierre:

```bash
npx tsc --noEmit --pretty false
npm run lint
npm run test:e2e
```

`npm run test:e2e` fuerza `PATH`, `E2E_NODE_PATH` y `PLAYWRIGHT_BROWSERS_PATH=0` para evitar que Vite arranque con un Node embebido incompatible.

## Problemas encontrados

### 0. El diálogo de bienvenida bloquea la UI (wizard `AppShell`)

Síntomas (Playwright):

```text
<dialog ...> intercepts pointer events
Test timeout ... waiting for locator ... Nuevo gasto
Target page, context or browser has been closed
```

Causa:

Con sesión válida, `AppShell` abre un **modal de bienvenida** si `localStorage.getItem("facturacion-wizard-seen") !== "1"`. El `<dialog>` tiene `z-[60]` y tapa toda la app: los tests hacen clic en botones de `main` pero los eventos los intercepta el diálogo.

Decisión:

En **`e2e/auth.setup.ts`**, el `addInitScript` que inyecta el token debe también hacer `localStorage.setItem("facturacion-wizard-seen", "1")` **antes** del primer `goto`, para que el `storageState` guardado ya lleve el wizard desactivado en todos los tests que dependen del setup.

Si un entorno reutiliza un `e2e/.auth/user.json` antiguo sin esa clave, borrar `e2e/.auth/` y volver a ejecutar el proyecto `setup`.

### 1. El test dependía de señales frágiles de UI

Síntomas:

```text
La pantalla de Facturar no termina de cargar datos del backend...
El documento cargado no queda guardable...
timeout esperando POST /api/documents
```

Causa:

El test mezclaba readiness visual con readiness de negocio. Algunas etiquetas `Cargando...` podían quedarse en DOM o no representar el estado real del formulario. También se validaba que el documento fuese guardable antes de reparar precondiciones que la recarga podía dejar incompletas.

Decisión:

Usar señales de negocio:

- perfiles reales en `select[name="templateProfileId"]`,
- ausencia visible del mensaje `Completa los módulos pendientes antes de guardar.`,
- `POST /api/documents`,
- `response.ok()`,
- `recordId`,
- `recordId` visible tras recarga,
- concepto editado enviado en el segundo guardado.

### 2. Auth no era el problema

`auth.setup.ts` pasaba. El bearer existía y se guardaba en storage state.

La causa estaba después: llamadas de la UI y proxy/routing de `/api`.

### 3. Vite devolvía HTML para `/api/config`

Síntoma clave:

```text
GET /api/config OK pero sin templateProfiles válidos para UI.
preview="<!doctype html> ... /@react-refresh ..."
```

Diagnóstico:

El navegador pedía `/api/config` con token presente, pero recibía el HTML de la app Vite en lugar del JSON del backend. Eso dejaba:

- `Perfil activo config: -`,
- `Perfil aplicado: -`,
- selector de perfiles vacío,
- histórico vacío,
- clientes vacíos.

**Desarrollo manual:** además del harness E2E, el repo define el mismo `proxy` de `/api` en `server` (comando `vite`) y en `preview` (`vite preview`) en `vite.config.ts`, para que una sesión local no reciba HTML de la SPA en rutas API. Detalle y smoke `curl` en README («API en desarrollo local»).

Decisión:

En el harness E2E, Playwright intercepta rutas reales `/api/**` y las reenvía a `E2E_API_TARGET` con bearer. Para `/api/config`, responde con el JSON real validado por Node mediante `fetchApiJson("/api/config")`.

Importante:

La ruta debe comprobar `sourceUrl.pathname.startsWith("/api/")`. No basta con un patrón amplio como `**/api/**`, porque eso también captura módulos de Vite como:

```text
/src/infrastructure/api/httpClient.ts
```

Cuando eso ocurrió, la app quedó en pantalla blanca.

### 4. `route.fetch` podía fallar al cerrar el contexto

Síntoma:

```text
route.fetch: Target page, context or browser has been closed
```

Causa:

Una request tardía a `/api/documents/detail` podía seguir en vuelo mientras Playwright cerraba la página tras terminar el test.

Decisión:

- `test.afterEach` llama a `page.unrouteAll({ behavior: "ignoreErrors" })`.
- El route handler ignora únicamente el error de cierre de página/contexto.
- Otros errores de backend o HTTP siguen fallando.

### 5. Rollup/Vite fallaba por Node y binario nativo en macOS

Síntoma:

```text
Cannot find module @rollup/rollup-darwin-arm64
ERR_DLOPEN_FAILED
code signature ... not valid for use in process:
mapping process and mapped file (non-platform) have different Team IDs
Node.js v24.14.0
```

Contexto:

El repo vive en:

```text
/Volumes/RAID/Repos/apps/facturacion/facturacion-react
```

Hubo contaminación de metadata de macOS en `node_modules/@rollup`, incluyendo un archivo `Icon` con resource fork. Además, según cómo se lanzara Playwright, Vite podía arrancar con un Node embebido distinto del Node esperado.

Decisiones:

- Limpiar/reinstalar Rollup cuando aparezca el error.
- Forzar `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH`.
- Exponer `E2E_NODE_PATH=/opt/homebrew/bin/node`.
- Hacer que `playwright.config.ts` arranque Vite con `E2E_NODE_PATH`.
- Mantener `PLAYWRIGHT_BROWSERS_PATH=0`.

## Cambios relevantes

### `e2e/browserApiHarness.ts`

- `fetchApiJson`, `fetchRuntimeConfigForE2E`, `bootstrapAuthInBrowser` (route solo si `pathname.startsWith("/api/")`; `/api/config` cumplido con JSON real).
- `archiveExpenseByRecordId` para limpieza del smoke Gastos.

### `e2e/critical-flows.spec.ts`

Responsabilidades actuales:

- Usa el harness anterior; lee bearer desde `e2e/.auth/bearer`.
- Inyecta token en `localStorage` y routea `/api/**` vía `bootstrapAuthInBrowser`.
- Rellena precondiciones mínimas de Facturar:
  - `templateProfileId`,
  - `templateLayout`,
  - `paymentMethod`,
  - `bankAccount`,
  - `client.name`,
  - `items.0.concept`,
  - `number`,
  - `items.0.quantity`,
  - `items.0.unitPrice`,
  - `issueDate`.
- Espera estado guardable por señal de negocio.
- Guarda y exige `POST /api/documents` OK + `recordId`.
- Recarga por `recordId`.
- Edita y vuelve a guardar.

### `e2e/expenses-flow.spec.ts`

- Smoke Gastos descrito en la sección «Smoke Gastos» de este runbook.

### `playwright.config.ts`

El `webServer` arranca Vite con:

```text
E2E_NODE_PATH || "node"
```

Esto evita depender de `process.execPath`, que puede apuntar a un Node embebido no deseado.

### `package.json`

Scripts E2E fijan:

```text
PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
E2E_NODE_PATH=/opt/homebrew/bin/node
PLAYWRIGHT_BROWSERS_PATH=0
```

## Resultado validado

En terminal de usuario, el flujo crítico pasó:

```text
2 passed
Facturar: crear, guardar, recargar y editar
```

También pasó el E2E completo:

```bash
npm run test:e2e
```

Resultado:

```text
2 passed
```

Validaciones de código:

```bash
npx tsc --noEmit --pretty false
npm run lint
```

Ambas pasaron.

Nota:

En la sesión de Codex puede fallar el arranque local de Vite con:

```text
listen EPERM: operation not permitted 127.0.0.1:4173
```

Ese fallo pertenece al sandbox local de la sesión, no al repo. La validación E2E válida fue la ejecutada en la terminal normal del usuario.

## Cómo investigar si vuelve a fallar

### Si falla antes de arrancar Vite

Buscar:

```text
@rollup/rollup-darwin-arm64
ERR_DLOPEN_FAILED
Team IDs
Node.js v24.14.0
```

Acciones:

1. Confirmar Node:

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" node -v
```

2. Confirmar Rollup:

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" node -e "import('rollup').then(() => console.log('rollup ok')).catch(e => { console.error(e); process.exit(1) })"
```

3. Si falla, limpiar/reinstalar Rollup:

```bash
rm -rf node_modules/@rollup node_modules/rollup
npm install
```

Si aparece metadata rara de macOS en `node_modules/@rollup`, revisar `xattr` y archivos `Icon`.

### Si la pantalla queda blanca

Sospechar que el route handler interceptó módulos de Vite. Confirmar que solo actúa cuando:

```ts
sourceUrl.pathname.startsWith("/api/")
```

Nunca interceptar por substring amplio que pueda capturar:

```text
/src/infrastructure/api/httpClient.ts
```

### Si `/api/config` parece vacío

Comprobar si el navegador recibe HTML en lugar de JSON. El preview típico empieza por:

```html
<!doctype html>
```

La solución correcta no es esperar más: hay que asegurar que `/api/config` vaya al backend real.

### Si falla guardabilidad

Mirar qué módulo sigue pendiente:

- Emisor,
- Datos del documento,
- Cliente,
- Conceptos,
- Fiscalidad,
- Guardar.

No añadir `skip`. Añadir una precondición explícita o mejorar selector si el campo existe con otro contrato.

### Si falla guardado

Confirmar:

- se lanza `POST /api/documents`,
- responde OK,
- contiene `recordId`,
- el payload conserva el concepto esperado.

### Si falla recarga

Confirmar:

- `GET /api/documents/detail?recordId=...` responde OK,
- el `recordId` aparece en UI,
- los campos clave vuelven a quedar guardables.

### Si un `<dialog>` bloquea clics (timeout en Gastos o Facturar)

Ver sección **«0. El diálogo de bienvenida»** arriba. Comprobar en captura o vídeo que el modal de bienvenida está abierto; revisar que `auth.setup.ts` fija `facturacion-wizard-seen` y que no se reutiliza un `storageState` obsoleto.

## Principios que no deben romperse

- Sin `test.skip`.
- Sin sleeps largos arbitrarios.
- Sin dar por bueno un guardado si no hubo `POST /api/documents`.
- Sin depender de texto genérico `Cargando...`.
- Sin ocultar fallos de backend.
- Sin usar documentos históricos como sustituto del create path: el flujo debe crear su propio documento E2E y editarlo.

## Archivos externos útiles

La aplicación genera documentos reales en:

```text
/RAID/Datos
```

Esos JSON/HTML/PDF pueden servir para inspeccionar shapes reales si un documento concreto falla al recargar o renderizar. No son necesarios para el happy path del test, pero sí son útiles para diagnóstico de datos.

