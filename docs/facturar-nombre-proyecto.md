# Campo «Nombre del proyecto» (Facturar)

Campo para indicar el **proyecto al que se factura o presupuesta**. Es independiente del
«ID del proyecto» (`projectId`) que ya existía en la plantilla.

## Dónde se rellena

- **React** (`src/features/invoices/pages/FacturarPage.tsx`): campo **«Nombre del proyecto»** en el
  bloque de datos del documento, a ancho completo. `placeholder`: «Nombre del proyecto al que facturas».
- **Legacy** (`public/index.html` + `public/app.js`): campo **«Nombre del proyecto»** dentro de
  «Más campos del documento», en su propia fila bajo «ID del proyecto».
  Se rellena al abrir un documento (`fillForm`) y se envía al guardar (`readFormDocument`).

> Antes de esto el formulario legacy no conocía el campo: al abrir y guardar un documento desde
> el legacy, `normalizeDocument` lo dejaba vacío y **se perdía el nombre**. Ya no ocurre.

## Modelo y persistencia

- `InvoiceDocument.projectName` (`src/domain/document/types.ts`).
- Default en `createEmptyDocument` (`src/domain/document/defaults.ts` y `public/modules/document-core.mjs`).
- Zod: `invoiceDocumentSchema` (`src/domain/document/schemas.ts`).
- Mapeo ida/vuelta en `src/infrastructure/mappers/documentMapper.ts`.
- Normalización en `document-core.mjs` (`normalizeDocument`): `String(document.projectName ?? "").trim()`.
- Se guarda en el JSON del documento (`POST /api/documents`) y se recarga al editar.

## Impresión en el documento (plantilla legacy)

La plantilla se construye en el **backend** (`public/modules/document-core.mjs`) y React solo
muestra el HTML resultante.

| Layout | Dónde aparece |
| --- | --- |
| `pear` / `reference` (`invoice-sheet-reference`) | **Caja bajo la cabecera** (`reference-project-strip` + `reference-project-row`), siempre ajustada al texto. Solo se configuran tamaño de texto y alineación en Diseño. |
| `voulita` (`invoice-sheet-voulita`) | Tarjeta `voulita-info-card` con etiqueta **PROYECTO**. |
| `editorial` (`invoice-sheet-editorial`) | Fila **Proyecto** en el detalle. |

En la plantilla por defecto ya **no** se imprime dentro de las cajas estrechas de 44 mm
(`issue-boxes`): los nombres largos se cortaban y no se leían. La caja se **ajusta siempre al
texto** (sin anchura manual) y usa `overflow-wrap: anywhere`, así que cualquier longitud se ve
completa. Su aspecto se controla desde **Diseño**: `projectNameSizePt` (6–18 pt, por defecto 9) y
`projectAlignX` (izquierda/centro/derecha, por defecto izquierda). El estilo vive en
`public/print.css` (`.reference-project-strip`, `.reference-project-row`,
`.reference-project-label`, `.reference-project-value`), con ajuste para las densidades
`compact-4` y `compact-5`.

Se normaliza en `document-core.mjs` (`projectName`) y, por tanto, aparece en la **vista previa**,
el **HTML oficial**, el **PDF** y el **PDF adjunto por Gmail** (mismo HTML del servidor).

## Verificación

Tests backend en `tests/document-project-name.test.mjs`:

- `normalizeDocument` recorta el nombre.
- Se imprime en las 3 plantillas.
- En `pear` va en `reference-project-row` (dentro de `reference-project-strip`) y **no** dentro de `issue-boxes`.
- La caja se ajusta al texto; solo se configuran tamaño (por defecto 9 pt) y alineación.
- Sin nombre no se imprime la franja.
- El formulario legacy tiene el input y lo carga/guarda.

## Nota de arquitectura

Cualquier cambio **visual** del documento (qué se imprime y dónde) se hace en el backend
(`document-core.mjs` + `print.css`), no en React. React aporta el dato (`projectName`) y muestra
el HTML.
