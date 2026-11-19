# Ver factura (HTML) en el informe del asesor

En el **informe compartido** (el enlace público que se envía al asesor/gestor, `/react/informe-compartido?t=…`) cada documento incluye ahora un botón **«Ver factura»**. Al pulsarlo se abre el **HTML oficial** de la factura **dentro de la misma página** (modal con visor escalable), sin login y sin salir del informe.

Antes, el informe público solo listaba metadatos (número, cliente, fecha, estado, total); la vista HTML solo estaba disponible en las pantallas internas (Historial/Gastos/Facturar, que requieren sesión).

## Cómo funciona

### Backend
- **`share-report-server.mjs`**
  - `shareInvoiceRef(recordId)` → `ref` opaco y estable: `sha256(recordId)` recortado a 16 hex. Se añade a cada fila en `sanitizePublicInvoiceRow`, de modo que el payload público (`GET /api/public-share-report/:token`) lleva un `ref` por factura sin exponer rutas del almacén.
  - `resolveShareInvoiceRecordId({ historyItems, spec, ref })` → devuelve el `recordId` real **solo si** esa factura pertenece al ámbito del informe (mismo `templateProfileId`, ejercicio, trimestres, estado, cliente).
- **`server.mjs`** — la ruta pública `GET /api/public-share-report/…` ahora distingue subrecursos:
  - `GET /api/public-share-report/:token` → informe JSON (igual que antes).
  - `GET /api/public-share-report/:token/invoice-html?ref=…` → **HTML oficial** de la factura. Valida token y caducidad, resuelve el `recordId` por `ref` con `resolveShareInvoiceRecordId` y sirve `composeRenderedDocumentHtml`. Es ruta pública (sin sesión), igual que el propio informe.

### Frontend
- **`src/infrastructure/api/exportReportsApi.ts`**: `PublicShareInvoiceRow.ref` + `buildPublicShareInvoiceHtmlUrl(token, ref)`.
- **`src/pages/SharedReportPublicPage.tsx`**: columna **Ver** en la tabla de documentos (y `colSpan` del separador de trimestre 8 → 9).
- **`src/features/asesor/components/PublicInvoiceHtmlDialog.tsx`**: modal que incrusta el HTML público reutilizando `ScaledHtmlPreview` (iframe con `sandbox="allow-same-origin"`, zoom ±, cierre con Escape/fondo).
- **`src/pages/sharedReportPickSum.tsx`**: el dock de totales ya no depende de que haya filas sumables; muestra los totales de la vista y los conmutadores de trimestre de facturas y gastos por separado.

### Filtros y exportación por trimestre
- El informe público filtra **independientemente** los trimestres de facturas y de gastos.
- El Excel se pide a `POST /api/public-share-report-export` con `invoiceQuarters` y `expenseQuarters` (antes se enviaba un único `quarters`). El servidor debe aplicar ambos campos para que el Excel coincida con lo que se ve en pantalla.

## Seguridad
- El `ref` es opaco (hash): no revela rutas internas del almacén.
- El endpoint solo sirve facturas **incluidas en ese informe** (filtro por emisor/periodo/estado del `meta` del enlace).
- El HTML se incrusta con `sandbox="allow-same-origin"` (sin scripts).

## Verificación
- Backend: informe de prueba servido → `ref` presente; `…/invoice-html?ref=<válido>` → `200 text/html`; `ref` inválido → `404`.
- Frontend: `npm run typecheck`, `npx vitest run` (99/99) y `npm run build` en verde.
