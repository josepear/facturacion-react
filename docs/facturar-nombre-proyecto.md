# Campo «Nombre del proyecto» (Facturar)

Campo para indicar el **proyecto al que se factura o presupuesta**. Es independiente del
«ID del proyecto» (`projectId`) que ya existía en la plantilla.

## Dónde se rellena (React)

- `src/features/invoices/pages/FacturarPage.tsx`: campo **«Nombre del proyecto»** en el bloque de
  datos del documento (debajo de Tipo/Número/Estado contable/Fecha emisión, a ancho completo).
- `placeholder`: «Nombre del proyecto al que facturas».

## Modelo y persistencia

- `InvoiceDocument.projectName` (`src/domain/document/types.ts`).
- Default en `createEmptyDocument` (`src/domain/document/defaults.ts`).
- Zod: `invoiceDocumentSchema` (`src/domain/document/schemas.ts`).
- Mapeo ida/vuelta en `src/infrastructure/mappers/documentMapper.ts`
  (`mapLegacyDocumentToForm` / `mapFormToLegacyDocument`).
- Se guarda en el JSON del documento (`POST /api/documents`) y se recarga al editar.

## Impresión en el documento (plantilla legacy)

La plantilla se construye en el **backend** (`public/modules/document-core.mjs`) y React solo
muestra el HTML resultante. El nombre se imprime en las **3 plantillas**, junto al «ID del proyecto»:

| Layout | Dónde aparece |
| --- | --- |
| `pear` / `reference` (`invoice-sheet-reference`) | Caja `issue-box project-id-box` con etiqueta **Proyecto** |
| `voulita` (`invoice-sheet-voulita`) | Tarjeta `voulita-info-card` con etiqueta **PROYECTO** |
| `editorial` (`invoice-sheet-editorial`) | Fila **Proyecto** en el detalle |

Se normaliza en `document-core.mjs` (`projectName`) y, por tanto, aparece en la **vista previa**,
el **HTML oficial**, el **PDF** y el **PDF adjunto por Gmail** (mismo HTML del servidor).

## Verificación

Render de un presupuesto con `projectName` («PROYECTO DEMO 2026») vía
`POST /api/documents/preview-html` → la salida contiene el nombre y la etiqueta «Proyecto».

## Nota de arquitectura

Cualquier cambio **visual** del documento (qué se imprime y dónde) se hace en el backend
(`document-core.mjs` + `print.css`), no en React. React aporta el dato (`projectName`) y muestra
el HTML.
