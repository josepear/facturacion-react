# Matriz de paridad Facturar: Legacy vs React

**Referencia legacy:** aplicación en `facturacion.pearandco.es` (no SaaS fallida).  
**Referencia React:** `FacturarPage.tsx`, `useFacturarForm.ts`, `InvoiceDocument` (`src/domain/document/types.ts`), `invoiceDocumentSchema` (`src/domain/document/schemas.ts`), `documentMapper.ts`, componentes en `src/features/invoices/components/`.

**Nota metodológica:** la columna «Legacy» describe el comportamiento esperable en producción y **debe contrastarse con checklist manual** en la UI legacy. Donce pone «validar en legacy», la fila queda **parcial** hasta completar esa revisión.

**Leyenda estado:** `cerrado` · `parcial` · `pendiente`  
**Leyenda prioridad:** P0 (bloquea operación diaria acordada) · P1 · P2

---

## 1. Emisor / perfil plantilla

| Campo / bloque | Legacy (ref. prod.; validar) | React actual | Brecha exacta | Implementación sugerida | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Perfil plantilla (`templateProfileId`) | Selector de perfil de emisor; obligatorio para numerar y guardar | `select` + `register("templateProfileId")`; opciones desde `GET /api/config`; Zod `min(1)` | Ninguna funcional obvia si config carga bien | — | Crear doc nuevo: perfil elegido persiste en POST | **cerrado** | P0 |
| Tenant (`tenantId`) | Contexto de tenant del documento (metadato) | Visible en Facturar como lectura (`Tenant documento`); al aplicar plantilla, si **`templateProfiles[].tenantId`** viene en config se escribe en el documento (misma rutina unificada que el primer anillo); si no, no se inventa tenant | No editable en UI (intencional, sin reglas nuevas) | — | Guardar/recargar conserva tenant; cambio de perfil con `tenantId` en API actualiza borrador | **cerrado** | P2 |
| Aplicar defaults al cambiar perfil | Legacy ajusta forma de pago, cuenta, layout, impuestos según perfil | `applyTemplateProfile` + `resolveEmitterFieldsFromTemplateProfile`: **perfil primero**, **`config.defaults` como capa** para `paymentMethod` / `taxRate` / `withholdingRate` / **`defaults.series`**; cuenta y layout desde perfil; `currency` y `colorKey` en hints UI; tres rutas unificadas (selector, `?templateProfileId=`, bootstrap si el borrador iba vacío) | Validar en legacy si al cambiar perfil se escriben **más** campos (texto legal, etc.) | Extender el resolver/handler cuando el contrato o el checklist lo documenten | Cambiar perfil: primer anillo = merge código; resto checklist prod | **parcial** | P1 |
| Metadatos perfil (solo lectura) | Puede mostrar etiqueta/color/tag numeración | Facturar (Emisor): contexto **id**, **etiqueta**, **tag** de numeración, **tenantId del perfil** si existe en API, más línea **defaults efectivos** (merge perfil + `config.defaults` igual que `applyTemplateProfile`) y **perfil activo servidor** | «validar en legacy» copy y campos extra (color, etc.) | Ajustar según checklist prod | Comparar con legacy | **parcial** | P2 |

---

## 2. Plantilla / layout

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Layout (`templateLayout` ↔ `design.layout` en legacy) | Campo o derivado del perfil para HTML/PDF | `Input` `register("templateLayout")`; mapper `mapLegacyDocumentToForm` usa `design.layout` | Ninguna obvia; validar nombres permitidos vs legacy | Documentar valores válidos (pear, etc.) | Salida oficial usa plantilla esperada | **parcial** | P1 |

---

## 3. Forma de pago

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `paymentMethod` | Texto / lista según legacy | `Input` libre; valor inicial al aplicar plantilla = **perfil `defaults` o, si falta, `config.defaults`** (`resolveEmitterFieldsFromTemplateProfile`) | Si legacy usa **catálogo cerrado**, React sigue siendo texto libre | Select o datalist alineado a legacy | Mismos valores que prod | **parcial** | P1 |

---

## 4. Cuenta bancaria

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bankAccount` | IBAN o texto visible en factura | `Input` + default perfil | Ninguna obvia | — | PDF/HTML muestran cuenta | **cerrado** | P0 |

---

## 5. Tipo de documento

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `type` (`factura` / `presupuesto`) | Selector tipos operativos | `select` solo factura/presupuesto | Si legacy incluye más tipos, faltan en modelo | Ampliar `DocumentType` + API si backend lo permite | Lista tipos legacy = React | **parcial** | P1 |

---

## 6. Número

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `number` | Obligatorio operativo; sugerencia desde servidor | `register("number")`; `getNextNumber` vía dominio | Ninguna en flujo feliz | — | E2E + manual | **cerrado** | P0 |
| `numberEnd` | «Número-Final» opcional en «Más campos del documento» | `register("numberEnd")` en desplegable; dominio + Zod + mapper | — | — | Guardar/recargar conserva valor | **cerrado** | P1 |

---

## 7. Serie

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `series` | Opcional / obligatorio según política | `Input` `register("series")`; **al aplicar plantilla**, si `defaults.series` existe en perfil o `config.defaults`, se rellena con el **mismo merge** que pago/IGIC (sobrescribe al cambiar perfil si hay valor resuelto; solo rellena hueco en bootstrap vacío) | Validar obligatoriedad estricta legacy | Reforzar validación Zod solo con evidencia | Guardar sin serie: mismo error/éxito que legacy | **parcial** | P1 |

---

## 8. Estado (contabilidad)

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `accounting.status` | ENVIADA / COBRADA / CANCELADA (o equivalente) | `select` `register("accounting.status")` | Ninguna obvia en enum | — | Recarga conserva estado | **cerrado** | P0 |
| `accounting.paymentDate` | Suele existir si «cobrada» | En modelo y mapper; **input `type="date"`** en Facturar | Sin checklist manual legacy/backend no se confirma obligatoriedad estricta | Mantener exposición + round-trip; no endurecer guardado sin evidencia contractual | E2E: crear/guardar/recargar conserva `paymentDate` | **parcial** | P1 |
| `accounting.quarter` | Si legacy asigna trimestre | Modelo + mapper; **input visible no restrictivo** en Facturar | Sin checklist manual legacy/backend no se confirma cálculo automático ni obligatoriedad | Mantener exposición + round-trip sin reglas duras; validar legado antes de automatizar | Guardar/recargar conserva `quarter` | **parcial** | P2 |
| `accounting.invoiceId` | Referencia contable / drive | Modelo + mapper (`invoiceId` / `driveLabel`) e **input visible no restrictivo** en Facturar | Sin checklist manual legacy/backend no se confirman formato ni reglas estrictas | Mantener exposición + round-trip sin bloqueo de guardado | Guardar/recargar conserva `invoiceId` | **parcial** | P2 |
| `accounting.netCollected` | Importe cobrado | Modelo + mapper; **input numérico** en Facturar (`setValueAs` → `number` para RHF+Zod) | Sin checklist manual legacy/backend no se confirman reglas de negocio sobre el importe | Exposición + round-trip; sin obligatoriedad ni rangos impuestos | Guardar/recargar conserva `netCollected` | **parcial** | P2 |
| `accounting.taxes` | Nota fiscal / impuestos texto | Modelo + mapper; **input texto** en Facturar (desplegable) | Sin checklist legacy sobre formato largo | — | Guardar/recargar conserva texto | **parcial** | P2 |

---

## 9. Fecha emisión / vencimiento / referencia

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `issueDate` | Obligatoria | `type="date"`; Zod `min(1)` | Ninguna obvia | — | E2E | **cerrado** | P0 |
| `dueDate` | Opcional / obligatoria según legacy | `type="date"`; Zod permite vacío | Validar obligatoriedad legacy | `refine` en schema si aplica | — | **parcial** | P1 |
| `reference` | Opcional | `Input` | Ninguna obvia | — | Aparece en preview/HTML | **cerrado** | P1 |

---

## 10. Cliente

| Campo | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nombre | Obligatorio | `client.name`; Zod `min(1)`; datalist + select guardados | Ninguna obvia | — | E2E | **cerrado** | P0 |
| NIF/CIF | Obligatorio según caso | `client.taxId` | Validar obligatoriedad vs legacy | Zod condicional o aviso | — | **parcial** | P1 |
| Email | Opcional / obligatorio | `client.email` | — | — | PDF | **cerrado** | P1 |
| Dirección, ciudad, provincia | Típicamente en factura | Inputs presentes | — | — | Preview | **cerrado** | P1 |
| País (`taxCountryCode`) | Código | Input | — | Select ISO si legacy usa lista | — | **parcial** | P2 |
| Tipo NIF | Catálogo posible | Input libre | Si legacy es lista cerrada, hay brecha | Select alineado | — | **parcial** | P1 |
| **Persona de contacto** | Si legacy lo muestra en factura | `client.contactPerson` en modelo, `replaceClientData`; **campo visible y editable en FacturarPage** | No se puede editar desde pantalla Facturar | Añadir `Field` + `register("client.contactPerson")` | Preview oficial y PDF muestran contacto; E2E valida persistencia round-trip | **cerrado** | P1 |

---

## 11. Conceptos (líneas)

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Concepto / descripción / cantidad / precio | Líneas estándar | `InvoiceItemsTable`; `items.*`; Zod exige ≥1 línea con concepto o descripción | Ninguna obvia en flujo base | — | E2E | **cerrado** | P0 |
| `lineTotal` | Si legacy fija total línea manual | Opcional en tipo y mapper | Si legacy edita total línea independiente del precio×cant | UI + reglas | — | **pendiente** | P2 |
| Modo ítems vs bruto (`totalsBasis`) | Si legacy tiene modo similar | `select` + `manualGrossSubtotal` cuando `gross` | Validar etiquetas y reglas legacy | Ajustar copy y validación checklist | Totales = legacy | **parcial** | P1 |

---

## 12. Fiscalidad (IGIC / IRPF / totales)

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IGIC (`taxRate`) | Porcentaje | Input numérico; Zod `nonnegative`; al aplicar plantilla: **perfil `defaults.taxRate` o, si no numérico finito, `config.defaults.taxRate`**; si ninguno aplica, no se sobrescribe el valor del formulario | Validar topes/catálogo legacy | — | Total cuadra con legacy | **parcial** | P1 |
| IRPF / sin IRPF | Típicamente 15/19/21 o ninguno | Atajos + input; Zod solo `"" \| 15 \| 19 \| 21`; `taxValidation` bloquea guardado; al aplicar plantilla: **primer valor válido (15/19/21)** entre perfil y `config.defaults`, si no **vacío** | Input libre puede dejar valores inválidos hasta blur | Mejor UX: solo select o sincronizar con atajos | No guardar con IRPF inválido | **cerrado** | P0 |
| Totales | Mostrados y coherentes | `calculateTotals` + `TotalsSummary`; guardado exige coherencia | Ninguna obvia | — | E2E + manual | **cerrado** | P0 |

---

## 13. Preview / salida oficial

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Preview en pantalla | Vista previa cercana a oficial | `DocumentLivePreview` + `buildLegacyPreviewModel` (adaptación) | Puede no coincidir pixel-perfect con legacy | Iterar modelo o enlazar preview servidor | Comparar con HTML oficial mismo `recordId` | **parcial** | P2 |
| HTML oficial | Abre documento renderizado | `openOfficialDocumentInNewTab` → `fetchWithAuth` + blob + misma ruta `/api/documents/rendered-html?recordId=` | Ninguna obvia si `serverRecordId` existe | — | E2E / manual | **cerrado** | P0 |
| PDF oficial | Abre PDF | Mismo helper; `/api/documents/pdf?recordId=`; mensaje si HTTP ≠ OK o pop-up bloqueado | PDF puede seguir sin existir en backend según entorno | — | Botón + feedback error | **parcial** | P1 |

### Ciclo de vida `recordId` → HTML/PDF (diagnóstico 2026)

| Momento | Legacy (ref.; validar en prod) | React (`useFacturarForm`) | Brecha |
| --- | --- | --- | --- |
| Tras **primer guardado** | Suele habilitar vista oficial con el id persistido | `saveMutation.onSuccess` → `setServerRecordId(recordId)`; URLs relativas `/api/documents/rendered-html` y `/api/documents/pdf` | Ninguna en habilitación de botones |
| Tras **recarga por `recordId`** (URL o «Recargar») | Mismo documento, mismas acciones de salida | `loadMutation.onSuccess` → `setServerRecordId(recordId)` | Ninguna en habilitación |
| Tras **editar y guardar de nuevo** | Salida oficial refleja revisión | Mismo `onSuccess` de guardado actualiza `serverRecordId` desde la respuesta | Ninguna en habilitación |
| Documento **nuevo** (sin guardar) | No debería ofrecer salida «oficial» hasta persistir | `serverRecordId` vacío → botones deshabilitados (`canOpenOfficialOutput`) | Alineado |

**Notas:** (1) Facturar e Historial comparten `openOfficialDocumentInNewTab` (`src/infrastructure/api/openOfficialDocumentOutput.ts`): Bearer, comprobación `response.ok`, blob y mensaje bajo los botones si falla o el navegador bloquea la ventana. (2) Habilitar el botón no garantiza PDF en servidor. (3) E2E crítico comprueba botones **habilitados** tras crear, recargar y editar; no descarga PDF en CI.

---

## 14. RecordId / recarga

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Carga inicial por URL | `?recordId=` | `useSearchParams` + `loadMutation` en efecto | Ninguna obvia | — | E2E recarga | **cerrado** | P0 |
| Recarga manual | Buscar por id | Input `recordId` + botón Recargar | — | — | — | **cerrado** | P0 |
| Texto `recordId` en UI | Visible tras guardar | `serverRecordId` en sidebar | — | — | — | **cerrado** | P1 |

---

## 15. Histórico desde Facturar

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Listado recientes | Lista documentos recientes | `GET /api/history`; últimos 40 ordenados; búsqueda texto + filtros por ejercicio y tipo + selector con contexto (tipo/importe) | Límite 40 vs legacy ilimitado/paginado | Paginación o «cargar más» | Usuario encuentra mismo doc que legacy | **parcial** | P1 |
| Cargar desde select | Abre en editor | `loadBySelectedHistory` | — | — | — | **cerrado** | P1 |

---

## 16. Botones y acciones

| Acción | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pedir siguiente número | Sí | `suggestNumber` → dominio `getNextNumber` | Requiere perfil seleccionado | — | — | **cerrado** | P0 |
| Validar disponibilidad | Sí | `checkNumberAvailability` | — | — | — | **cerrado** | P0 |
| Guardar | Sí | Submit → `saveDocument` | — | — | E2E | **cerrado** | P0 |
| Ver HTML / PDF | Sí | `openOfficialOutput` en hook + helper autenticado si hay `serverRecordId` | Deshabilitados hasta guardar (correcto) | — | E2E habilitación | **cerrado** | P0 |

---

## 17. Módulo Historial (misma salida oficial, otro punto de entrada)

| Acción | Legacy (ref.; validar) | React (`HistoryPage`) | Brecha exacta | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- |
| Localizar documento | Listado + filtros/búsqueda según legacy | Lista `GET /api/history` + **tipo** (todos/factura/presupuesto) + **ejercicio** (`issueDate` YYYY) + texto (número, cliente, recordId, etiqueta/código tipo); conteo N/M; limpieza de filtros visible y persistencia de filtros en URL (`q`, `type`, `year`) | Filtro por estado contable, perfil, rangos de fecha u otros criterios legacy sin contrato en `GET /api/history` | Encontrar doc con mismos criterios que en legacy cuando aplique | **parcial** | P1 |
| Estado contable en detalle | Suele visible al revisar documento en legacy | Panel «Documento abierto» muestra `accounting.status` del detalle (`GET /api/documents/detail`) con etiqueta legible (solo lectura) | Filtro por estado en listado sigue sin contrato | Abrir documento y comprobar coherencia con Facturar | **cerrado** | P1 |
| Selección clara | Resaltado fila / contexto | Resaltado + `recordId` en cabecera del panel; aviso si la fila no está en lista filtrada; deep link por `recordId` en URL para reabrir selección | — | Abrir `/historial?recordId=...` carga el detalle de ese documento si existe | **cerrado** | P1 |
| Abrir en Facturar | Navegación a edición con id | `navigate` a `/facturar?recordId=` y `templateProfileId` si viene en el documento | Ninguna obvia | Editar y guardar como en flujo Facturar | **cerrado** | P0 |
| HTML/PDF oficial | Abrir render y PDF para el id | Mismo helper `openOfficialDocumentInNewTab` que Facturar | — | Éxito o mensaje claro | **cerrado** | P0 |

---

## Resumen de brechas por prioridad (para backlog)

### P0 (operación diaria acordada)

- Ninguna brecha **nueva** crítica detectada en código más allá de lo ya cubierto por E2E y proxy (perfil, cliente, líneas, fechas, guardado, recarga, HTML/PDF).  
- **P1/P2 pendientes** no bloquean el happy path E2E documentado.

### P1 (paridad operativa / datos completos)

1. Campos **contables extendidos** en Facturar: expuestos en «Más campos del documento» + mapper; obligatoriedad estricta solo con evidencia legacy/backend.  
2. **`client.contactPerson`**: editable en Facturar (desplegable «Más datos del cliente»); E2E y round-trip cubiertos.
3. **Catálogos** alineados con legacy: `paymentMethod`, tipo documento si hay más tipos, tipo NIF, obligatoriedad NIF/fecha vencimiento.  
4. **Histórico**: límite 40 ítems; puede ser insuficiente vs legacy.  
5. **PDF**: confirmar disponibilidad endpoint en todos los despliegues.

### P2 (calidad / profundidad)

- Preview local vs pixel-perfect legacy.  
- `lineTotal` manual por línea.  
- País como select ISO.

---

## Criterio de cierre de este documento

- **Estado global:** **parcial** — la matriz es accionable y priorizada; varias filas legacy requieren **validación manual en prod** (marcadas explícitamente).  
- Cuando el equipo complete el checklist legacy fila a fila, actualizar columna Legacy y estados a `cerrado` o `pendiente` con evidencia.

---

*Última actualización: alineada con código en repo; sin secretos.*
