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
