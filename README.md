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
- `docs`: decisiones de Fase 0 (reutilización y guardrails).

## Vertical slice actual
`InvoiceDraftPage` valida la base técnica:
- crea borrador tipado,
- edita cliente + una línea,
- calcula totales,
- valida con Zod,
- guarda/carga contra API existente.

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
