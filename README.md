# Facturacion React

Base limpia de frontend para facturación, iniciada en Fase 0.

## Stack
- React + TypeScript estricto
- Vite
- React Router
- TanStack Query
- React Hook Form + Zod
- Tailwind CSS + componentes base estilo shadcn/ui

## Estructura
- `src/app`: bootstrap, providers, router.
- `src/domain`: reglas y contratos de negocio.
- `src/infrastructure`: APIs y adaptadores.
- `src/features`: casos de uso de producto.
- `src/components`: librería reutilizable.
- `docs`: decisiones de Fase 0 (reutilización y guardrails); flujo Git en [`docs/git-workflow.md`](docs/git-workflow.md).
- `scripts/legacy-html-field-inventory.mjs`: extrae todos los `name="..."` del `index.html` legacy agrupados por pestaña (`data-tab-panel`), para checklist antes de implementar en React.

## Paridad legacy → React (inventario automático)

Con el monorepo `facturacion` colocado junto a `facturacion-react` (ruta por defecto `../public/index.html`):

```bash
npm run inventory:legacy          # JSON en stdout (redirige a archivo si quieres snapshot)
npm run inventory:legacy:md       # tablas Markdown en stdout
```

No sustituye revisar payloads en `app.js` ni el contrato `/api/*`, pero evita descubrir a medias campos que ya existen en el HTML.

## Vertical slice actual
`InvoiceDraftPage` valida la base técnica:
- crea borrador tipado,
- edita cliente + una línea,
- calcula totales,
- valida con Zod,
- guarda/carga contra API existente.

## API en desarrollo local (proxy Vite)

Las llamadas del navegador van a rutas relativas (`/api/config`, etc.). Vite debe **reenviar** `/api` al backend; si no (p. ej. `vite preview` sin proxy), el servidor puede responder con **HTML de la SPA** (`index.html`) y la app verá perfiles/clientes vacíos.

- **`npm run dev` y `npm run preview`:** el `proxy` de `vite.config.ts` reenvía **`/api/*`** y **`POST /login`** hacia `E2E_API_TARGET` o, por defecto, el host de producción de referencia.
- **Comprobación rápida** (con el servidor arrancado; el cuerpo debe ser JSON, no empezar por `<`):

```bash
npm run dev
# En otra terminal, ajusta el puerto si Vite muestra otro (por defecto 5173; E2E suele usar 4173):
curl -sS "http://127.0.0.1:5173/api/config" | head -c 80
```

**E2E:** Playwright reenvía además las peticiones `/api/*` del navegador al `E2E_API_TARGET` (ver `e2e/critical-flows.spec.ts` y el runbook); eso no sustituye el proxy en el día a día manual, pero garantiza el contrato bajo test.

## E2E real (Playwright)
1. Copia `.env.e2e.example` a `.env.e2e`.
2. Ajusta `E2E_API_TARGET` al backend válido para pruebas.
3. Autenticación E2E: usa `E2E_USER_TOKEN` (preferido) o `E2E_USER_EMAIL` + `E2E_USER_PASSWORD`.
4. Ejecuta:

```bash
npx playwright install chromium
npm run test:e2e
```

Precondiciones validadas automáticamente antes de lanzar tests:
- `GET /api/health` responde OK.
- `GET /api/config` devuelve al menos un `templateProfile`.
- Si `E2E_REQUIRE_EXPENSE_WRITE=true`, `GET /api/expense-options` responde con estructura válida.

Runbook/postmortem del flujo crítico de Facturar:
- [`docs/e2e-facturar-critical-flow-runbook.md`](docs/e2e-facturar-critical-flow-runbook.md)
