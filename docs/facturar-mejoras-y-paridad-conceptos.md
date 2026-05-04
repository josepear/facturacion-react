# Facturar: paridad de conceptos, Guardar y otras mejoras

Este documento resume los cambios funcionales y de UI incorporados en la rama de trabajo (p. ej. `feat/gastos-parity`), con foco en **Facturar** y en el alineamiento con la app legacy.

## 1. Conceptos: precio por persona y ocultar subtotal en concepto

**Objetivo:** Replicar en la SPA React el comportamiento de legacy en *Facturar → Concepto*: «Precio por persona» y «Ocultar subt. en concepto».

### Comportamiento (referencia legacy `public/app.js`)

- **`unitLabel`:** Si el modo por persona está activo, al persistir se usa la etiqueta `persona`. El modo por persona se detecta cuando `unitLabel` normalizado es uno de: `persona`, `personas`, `comensal`, `comensales`, `pax`.
- **Cantidad:** En modo por persona es un entero de comensales (≥ 0); vacío se interpreta como 1 al activar el modo, coherente con la lectura del formulario legacy.
- **`hidePerPersonSubtotalInBudget`:** Solo aplica en modo por persona; al desactivar el modo se fuerza a `false` y, si la etiqueta era solo de modo por persona, `unitLabel` queda vacío.
- **Totales:** `calculateTotals` redondea la cantidad en modo por persona antes de aplicar `cantidad × precio` (salvo importe de línea manual explícito).

### Implementación en React

| Área | Archivos |
|------|-----------|
| Reglas de dominio | `src/domain/document/perPersonPricing.ts` (`isPerPersonUnitLabel`, `normalizePerPersonQuantity`, `unitLabelAfterDisablingPerPerson`) |
| Modelo y validación | `src/domain/document/types.ts`, `schemas.ts`, `defaults.ts` |
| Cálculo | `src/domain/document/calculateTotals.ts` |
| Persistencia / JSON legacy | `src/infrastructure/mappers/documentMapper.ts` (`mapItem`, `mapFormToLegacyDocument`) |
| Vista previa adaptada | `src/features/invoices/adapters/renderLegacyPreview.ts` (texto de importe por línea: comensales × precio vs «· / persona» cuando se oculta el subtotal en concepto) |
| UI líneas | `src/features/invoices/components/InvoiceItemsTable.tsx` (checkboxes, etiquetas Comensales / € x persona, hint, stepper +/−) |
| Formulario | `src/features/invoices/pages/FacturarPage.tsx` (`useFieldArray.append` con campos por defecto) |

El hook `useFacturarForm` pasa `unitLabel` y `hidePerPersonSubtotalInBudget` al cálculo intermedio de `totals` para que el resumen y los totales coincidan con el borrador.

## 2. Guardar: resumen del documento y previsualización HTML

**Objetivo:** En el módulo **Guardar** de Facturar, mostrar un resumen de lo rellenado y, cuando exista documento guardado, una vista incrustada del **HTML oficial** del servidor.

### Resumen (`FacturarSaveSummary`)

- Bloques: Emisor, Documento, Cliente, Fiscal, Importes, Líneas (concepto/descripción corta + importe de línea).
- Datos tomados de `liveDocument` y de `totals.items` (importes de línea coherentes con modo por persona).

### HTML oficial (`FacturarOfficialHtmlPreview`)

- Si hay **`serverRecordId`:** `GET /api/documents/rendered-html?recordId=…` con sesión (`fetchWithAuth`), respuesta en **blob** y `iframe` con `URL.createObjectURL` (misma fuente que «Ver HTML oficial»).
- Tras **guardar** o **cargar** un documento se incrementa `officialHtmlPreviewVersion` en `useFacturarForm` para forzar una nueva petición y refrescar el iframe.
- Si el formulario está **sucio** (`isDirty`) y ya hay `recordId`, se muestra un aviso: el HTML incrustado es el del **último guardado**, no del borrador actual.
- Si **no** hay `recordId` (documento nuevo): mensaje explicativo + `DocumentLivePreview` (vista React aproximada) hasta el primer guardado.

### Archivos

- `src/features/invoices/components/FacturarSaveSummary.tsx`
- `src/features/invoices/components/FacturarOfficialHtmlPreview.tsx`
- `src/features/invoices/pages/FacturarPage.tsx` (integración en el `WorkflowModule` Guardar)
- `src/features/invoices/hooks/useFacturarForm.ts` (`officialHtmlPreviewVersion`, bumps en `saveMutation` / `loadMutation` `onSuccess`)

La previsualización React junto a **Fiscalidad** (`DocumentLivePreview`) se mantiene; el módulo Guardar añade resumen + HTML oficial (o preview React solo en documentos nuevos).

## 3. Otras mejoras en la misma entrega

Además de lo anterior, en esta rama hay cambios transversales de **UI responsive** y ajustes de layout en pantallas como Clientes, Gastos, Historial, Ajustes, Datos, login y componentes compartidos (`AppShell`, `Field`, `Card`, `WorkflowModule`, `TotalsSummary`, estilos en `src/styles/`). La convención está descrita en `.cursor/rules/facturacion-responsive-ui.mdc`.

Otros detalles Facturar en el diff: cabecera de factura (`InvoiceHeader`), totales (`InvoiceTotalsPanel`), tests del hook (`useFacturarForm.test.tsx`), y refactors de layout en `FacturarPage` / `useFacturarForm` asociados al flujo por módulos.

## 4. Cómo probar

1. **Por persona:** Activar «Precio por persona», comprobar comensales enteros, hint, «Ocultar subt. en concepto», totales y texto en la vista previa adaptada.
2. **Guardar:** Rellenar Facturar, abrir Guardar → resumen coherente; guardar → iframe con HTML oficial; editar sin guardar → aviso de desalineación con el servidor.
3. **E2E:** Flujo crítico Facturar (`e2e/critical-flows.spec.ts`) si aplica en tu entorno.

## 5. Despliegue

Los cambios son de frontend en `facturacion-react`. Para verlos en el dominio público sigue el flujo habitual del monorepo (build + despliegue al mini según `deploy-to-macmini.sh` y reglas de proyecto).
