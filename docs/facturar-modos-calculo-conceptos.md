# Facturar: modos de cálculo de conceptos (por concepto / por bruto)

En **Facturar → Conceptos → «Modo cálculo conceptos»** hay dos modelos. Ambos imprimen en la vista
previa (HTML oficial y resumen) los **conceptos** y el **total a cobrar** al final; lo que cambia es
de dónde salen las cifras.

## Por concepto (suma líneas) — `totalsBasis: "items"`

- Cada línea aporta `cantidad × precio` (o un `lineTotal` manual si se informa).
- `subtotal` = suma de líneas; IGIC e IRPF se calculan sobre ese subtotal:
  `total = subtotal + IGIC − IRPF`.
- Es el modo por defecto.

## Por bruto (importe manual) — `totalsBasis: "gross"`

- Aparece el campo **«Importe bruto (base)»** (`manualGrossSubtotal`).
- Con un importe > 0:
  - `subtotal` = importe bruto manual.
  - IGIC e IRPF se calculan sobre ese bruto.
  - `total = subtotal + IGIC − IRPF`.
- Las líneas son **solo texto** (concepto/descripción): no se usan sus cantidades ni precios y no
  se imprimen cifras por línea en la vista previa ni en el resumen.
- Si el importe manual es **0 o vacío**, el cálculo cae de nuevo en la suma de líneas (el campo es
  opcional para no romper borradores antiguos).

## Checklist y validación

- **Por concepto**: se exige al menos una línea con descripción y precio válido.
- **Por bruto**: basta con al menos un concepto escrito y `manualGrossSubtotal > 0`; entonces el
  módulo Conceptos y el botón Guardar dejan de estar pendientes.
- `manualGrossSubtotal` se guarda en el documento y se recupera al cargar/duplicar.

## Dónde está el código

- `src/domain/document/calculateTotals.ts` — regla de cálculo (`items` vs `gross`).
- `src/domain/document/schemas.ts` / `types.ts` — contrato (`totalsBasis`, `manualGrossSubtotal`).
- `src/features/invoices/pages/FacturarPage.tsx` — selector de modo y campo de importe bruto.
- `src/features/invoices/components/InvoiceItemsTable.tsx` — líneas sin cifras en modo bruto.
- `src/features/invoices/hooks/useFacturarForm.ts` — totals, checklist y reset al cambiar de modo.
- `src/features/invoices/adapters/renderLegacyPreview.ts` — etiqueta/base de la vista previa.
- `src/features/invoices/components/FacturarSaveSummary.tsx` — resumen lateral.
- `src/infrastructure/mappers/documentMapper.ts` — persistencia del campo.

## Tests

- `src/domain/document/calculateTotals.test.ts` — suma de líneas, bruto manual y caída a líneas con 0.
- `src/features/invoices/hooks/useFacturarForm.test.tsx` — checklist y guardado en modo por bruto.
