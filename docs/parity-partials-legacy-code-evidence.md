# Parciales: evidencia en código legacy (`public/app.js`)

Lectura estática del monolito servido con la API (mismo repo que `server.mjs`). Sirve para **cerrar dudas de UI / validación cliente** sin abrir el navegador; lo que dependa solo del **backend** o de **PDF/HTML** sigue marcado como `(parcial)` en el roadmap hasta probar en prod.

**Checklist en el navegador (prod):** [`parity-manual-prod-checklist.md`](./parity-manual-prod-checklist.md).

**Fecha revisión:** 2026-05-03

---

## Facturar — tipo de documento

- **`normalizeDocumentTypeValue`** (~L3778–3780): cualquier valor que no sea exactamente `presupuesto` (trim + lower) se trata como **`factura`**. No hay más tipos en el cliente legacy.
- **Roadmap / matriz:** la fila «¿más tipos en legacy?» puede darse por **cerrada** a nivel de contrato UI+normalización.

## Facturar — checklist antes de guardar (`evaluateBillingWorkflow`)

Función ~L1411–1498. Secciones bloqueantes: `profile`, `document`, `client`, `items`, `taxes`.

| Tema | Comportamiento legacy |
| --- | --- |
| **Documento (`document`)** | Exige: tipo, fecha emisión (`issueDate`), **número**, estado contable (`accountingStatus`). **No** exige `series` ni `dueDate` en este bloque. |
| **Cliente (`client`)** | Exige **solo nombre** (`normalizedDocument.client.name`). **No** exige NIF/CIF para marcar el paso completo. |
| **Impuestos (`taxes`)** | IGIC (`taxRate`) no vacío y numérico finito. IRPF: **15, 19 o 21** (tolerancia numérica) **o** checkbox «sin IRPF» (`noWithholdingConfirmed`). ~L1462–1477. |

La SPA React replica la lógica de IRPF/IGIC para habilitar guardado en `useFacturarForm` (`taxValidation`).

## Gastos — guardar

- Handler del botón guardar ~L17038–17046: exige **`vendor` o `description`** (no ambos vacíos); mensaje explícito si falla.
- Alineado con la validación React (Zod) que permite uno u otro. Matriz §1 `vendor`: estado **cerrado** con esta cita.

## Qué sigue siendo `(parcial)` de verdad

- **Catálogos cerrados** (`paymentMethod`, `category` gastos, `taxIdType`, etc.): hay que mirar **HTML** (`index.html`) o comportamiento en prod, no solo `app.js`.
- **`applyTemplateProfile` / defaults completos:** comparar con respuesta real de `GET /api/config` y con lo que rellena legacy al cambiar perfil.
- **Preview vs HTML oficial / PDF estable:** depende de entorno y backend.
- **Campos contables extendidos** (`accounting.*` salvo lo que ya viaja): reglas de negocio y formato en servidor o en plantilla.

---

## Cómo ampliar esta lista

1. Grep en `public/app.js` con el nombre del campo o del mensaje de error.
2. Añadir fila aquí + actualizar [`facturar-field-parity-matrix.md`](./facturar-field-parity-matrix.md) / [`gastos-field-parity-matrix.md`](./gastos-field-parity-matrix.md) / [`roadmap-paridad.md`](./roadmap-paridad.md).
3. Si solo queda riesgo de API, dejar el ítem del roadmap como `(parcial)` con nota «UI cerrada; validar POST».
