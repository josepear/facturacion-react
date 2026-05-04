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

## 2. Columna derecha Facturar: resumen en vivo, HTML plantilla legacy y acciones Guardar

**Objetivo:** Mientras rellenas los módulos de la izquierda, la columna derecha (sticky) muestra un **resumen** que se actualiza con `liveDocument` y el **HTML de la misma plantilla legacy** que el PDF/HTML guardados, sin tener que abrir solo al final.

### Resumen (`FacturarSaveSummary`)

- Bloques: Emisor, Documento, Cliente, Fiscal, Importes, Líneas (concepto/descripción corta + importe de línea).
- Datos tomados de `liveDocument` y de `totals.items` (importes de línea coherentes con modo por persona).

### HTML plantilla legacy (`FacturarLegacyHtmlPane`)

- **Borrador o cambios sin guardar:** `POST /api/documents/preview-html` con el JSON del documento (sesión). El servidor aplica `bindDocumentToTemplateProfile` y `renderDocumentHtml` (misma pipeline que el HTML persistido). En cliente se usa `useDeferredValue` + debounce ~420 ms para no saturar.
- **Último guardado y formulario limpio:** `GET /api/documents/rendered-html?recordId=…` (misma salida que «Ver HTML oficial»).
- Tras **guardar** o **cargar**, `officialHtmlPreviewVersion` en `useFacturarForm` fuerza a refrescar la rama GET cuando corresponde.
- **Vista incrustada:** el HTML se escala al ancho (y alto) del contenedor con `ResizeObserver` + `transform: scale`, en la línea de la legacy `fitPreviewToViewport`. Clic en el área (o botón «Ampliar») abre un **modal** (`<dialog>`) con lupa **+** / **−** (pasos de zoom sobre el ajuste a caja, tope de escala total ~2.25).

### Archivos (React)

- `src/features/invoices/components/FacturarSaveSummary.tsx`
- `src/features/invoices/components/FacturarLegacyHtmlPane.tsx`
- `src/infrastructure/api/documentsApi.ts` (`fetchDocumentLegacyPreviewBlob`)
- `src/features/invoices/pages/FacturarPage.tsx` (columna derecha sticky: resumen + HTML + `WorkflowModule` Guardar con botones)
- `src/features/invoices/hooks/useFacturarForm.ts` (`officialHtmlPreviewVersion`)

### Servidor (monorepo `facturacion`)

- `server.mjs`: `renderBoundDocumentHtml` (extraído de la lógica de `composeRenderedDocumentHtml`), ruta **`POST /api/documents/preview-html`**.

Se retiró la vista React `DocumentLivePreview` de esta pantalla en favor del HTML legacy en vivo; la aproximación React sigue disponible en el código por si se reutiliza en otro flujo.

## 3. Otras mejoras en la misma entrega

Además de lo anterior, en esta rama hay cambios transversales de **UI responsive** y ajustes de layout en pantallas como Clientes, Gastos, Historial, Ajustes, Datos, login y componentes compartidos (`AppShell`, `Field`, `Card`, `WorkflowModule`, `TotalsSummary`, estilos en `src/styles/`). La convención está descrita en `.cursor/rules/facturacion-responsive-ui.mdc`.

Otros detalles Facturar en el diff: cabecera de factura (`InvoiceHeader`), totales (`InvoiceTotalsPanel`), tests del hook (`useFacturarForm.test.tsx`), y refactors de layout en `FacturarPage` / `useFacturarForm` asociados al flujo por módulos.

## 4. Cómo probar

1. **Por persona:** Activar «Precio por persona», comprobar comensales enteros, hint, «Ocultar subt. en concepto», totales y texto en la vista previa adaptada.
2. **Columna derecha:** Comprobar que el resumen y el iframe HTML se actualizan al rellenar; con documento guardado y sin cambios pendientes, el GET coincide con «Ver HTML oficial»; con borrador o cambios, vista POST en vivo tras el debounce.
3. **E2E:** Flujo crítico Facturar (`e2e/critical-flows.spec.ts`) si aplica en tu entorno.

## 5. Despliegue

Los cambios son de frontend en `facturacion-react`. Para verlos en el dominio público sigue el flujo habitual del monorepo (build + despliegue al mini según `deploy-to-macmini.sh` y reglas de proyecto).

## 6. Reinicio del flujo izquierdo tras guardar (Facturar)

Tras un **guardado correcto** del documento, los módulos del flujo (Emisor, Documento, Historial, Cliente, Conceptos, Fiscalidad) vuelven al **modo automático** del checklist: se resetean `moduleUiMode` a `"auto"`, se quita el pin de Conceptos, se cierra el detalle extra del cliente, se sincroniza la referencia del módulo abierto con el checklist y se reinicia la lógica de scroll (`workflowLayoutResetVersion` en `useFacturarForm`, consumido por un `useEffect` en `FacturarPage`).

| Archivo | Rol |
|---------|-----|
| `src/features/invoices/hooks/useFacturarForm.ts` | Incrementa `workflowLayoutResetVersion` en `saveMutation.onSuccess`. |
| `src/features/invoices/pages/FacturarPage.tsx` | Efecto que aplica el reset antes del efecto del pin de Conceptos. |

## 7. Emisores, roles y nomenclatura (Configuración y app)

- **Copy:** En la interfaz, lo que antes se llamaba «perfil» (plantilla/emisor) pasa a **emisor / emisores** en Facturar, Historial, Gastos, Datos, importación histórica, cabecera legacy, E2E y navegación (`AppShell`: entrada «Emisores»). Los identificadores de API (`templateProfileId`, etc.) no cambian.
- **Roles:** Los **administradores** pueden crear o borrar emisores, propagar diseño a facturas antiguas, papelera, Gmail y la tarjeta **Miembros del sistema**. El **catálogo de gastos** (proveedores/categorías) se administra en el módulo **Gastos**, no en Emisores. Los **editores** pueden **editar y guardar** emisores ya existentes y cambiar el emisor activo; no pueden crear/borrar emisores ni gestionar miembros. Los **viewers** siguen en solo lectura en Configuración.
- **Servidor:** Si `POST /api/template-profiles` devolviera 403 para editores, habría que alinear la política en backend con esta UI.

### Corrección de bucle (papelera / no admin)

`TrashSection` seguía montando hooks aunque `canEdit` fuera `false`. Con datos vacíos, `items = data?.items ?? []` creaba un **array nuevo en cada render**; el `useEffect` dependiente de `items` llamaba a `setState` sin fin. Se usa una constante `EMPTY_TRASH_ITEMS` estable.

## 8. Pruebas (Vitest)

- **`src/test/setup.ts`:** el mock ligero de `useQuery` ya no lista `queryFn` en las dependencias del `useEffect` (se usa `useRef`), evitando refetch infinito cuando `queryFn` es inline.
- **`SettingsPage.test.tsx`:** caso de editor que puede guardar y no crear emisores; textos alineados con «Emisor».
- Comando útil: `npx vitest run src/features/settings/pages/SettingsPage.test.tsx`.
