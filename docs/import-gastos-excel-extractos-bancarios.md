# Importar gastos desde Excel (extractos bancarios)

**Fecha:** 2026-10-12
**Ámbito:** `ExpensesPage` (`/gastos`) · endpoint `POST /api/control-expenses-import`
**Estado:** cerrado y desplegado.

Este documento describe cómo funciona el importador de gastos por Excel, los formatos de
extracto de banco soportados, y las mejoras de quita/selección de filas y de fechas.

---

## 1. Flujo de usuario

1. **Gastos → Importar gastos** (solo admin).
2. Se elige **Emisor destino** y un archivo **`.xlsx`** (el `.xls` no se procesa).
3. **Vista previa Excel** → se abre un **popup a todo el ancho** con las filas detectadas,
   **sin guardar nada** todavía.
   - Tabla: `Quitar · Hoja · Fila · Fecha · Trimestre · Proveedor · Concepto · Importe · Aviso`.
   - Cada fila tiene un botón **✕ (Quitar)**; se importan **las que queden**.
   - La **confirmación está dentro del popup** (“Confirmar importación (N)”); al cerrarlo,
     el botón **“Ver vista previa (N)”** de la tarjeta lo vuelve a abrir.
4. **Confirmar importación (N)** → se crean las **N filas que quedan en la vista previa**.

> Nota de UX: durante la vista previa el bloque *Resultado* muestra `Creados en servidor: 0`.
> Es correcto: en vista previa no se persiste nada. Los “Omitidos” de la vista previa son
> los **ingresos** del extracto (importes positivos), que se ignoran a propósito.

---

## 2. Contrato de la API

`POST /api/control-expenses-import`

```jsonc
{
  "templateProfileId": "jose-mendoza",
  "files": [{ "name": "movements.xlsx", "contentBase64": "…" }],
  "previewOnly": true,                 // true = vista previa (no persiste)
  "selectedRowKeys": ["Movimientos::5", "Movimientos::7"] // opcional; solo al confirmar
}
```

- `selectedRowKeys`: claves `${sheet}::${row}` de las filas **a importar** (las que quedan en la
  vista previa tras quitar las que no quieras). Si **no se envía**, se importan **todas** las
  filas válidas (retrocompatible).
- Se usa `::` como separador porque el carácter `:` **no es válido** en un nombre de hoja
  de Excel, así que no hay colisión.
- `row` es el **número de fila de Excel (1-based)**.

Respuesta en vista previa:

```jsonc
{ "ok": true, "preview": true, "previews": [ { "file": "…", "sheet": "Movimientos",
  "row": 5, "duplicateExisting": false, "expense": { /* ExpenseRecord */ } } ],
  "skipped": [ /* motivos */ ], "errors": [], "conceptResolution": { /* … */ } }
```

Respuesta al confirmar:

```jsonc
{ "ok": true, "created": 187, "skipped": [ /* … */ ], "errors": [], "conceptResolution": { } }
```

---

## 3. Detección de cabeceras (`findExpenseHeaderRow`)

Escanea las primeras **14 filas** de cada hoja buscando una fila que mapee, a la vez:

| Necesita | Encabezados reconocidos |
| --- | --- |
| **Fecha** | cualquier cabecera con `fecha`; y abreviaturas de banco `F. VALOR`, `F. OPERACIÓN`, `F. CONTABLE`, `F. LIQUIDACIÓN`, `F. EMISIÓN`, `F. DEVENGO`, `F. CARGO/ABONO`, `F. FACTURA` |
| **Importe** | `importe`, `cantidad` (extractos ING), `cargo`, `abono` |
| **Concepto o proveedor** | `concepto`, `descripción`, `detalle`, `movimiento`, `proveedor`, `beneficiario`, `ordenante`, `contraparte` |

Ejemplo real soportado (hoja `Movimientos`):

```
F. VALOR | CATEGORÍA | SUBCATEGORÍA | DESCRIPCIÓN | COMENTARIO | IMPORTE (€) | SALDO (€)
```

`SALDO` se ignora siempre. Si la cabecera no encaja en las primeras 14 filas, la hoja se
omite con `Sin cabeceras reconocibles (fecha, concepto o proveedor, e importe).`

---

## 4. Reglas de negocio del import

- **Signo:** en extractos (hoja no “legacy”), un `importe > 0` es un **ingreso** y se omite
  (`Importe positivo (posible ingreso); no importado como gasto.`). Los gastos (negativos)
  se guardan con `total`/`subtotal` en **positivo**.
- **Fecha:** para celdas que llegan como objeto fecha (SheetJS `cellDates`), se usan los
  **componentes locales** (`getFullYear/getMonth/getDate`), no `toISOString()` (UTC). Evita el
  **desfase de un día** (p. ej. `05/10/2026` guardado como `2026-10-04`) y, por tanto, errores
  de **trimestre** en los bordes.
- **Trimestre:** se deriva de la fecha; si la hoja contiene `Q1..Q4` en el nombre, se usa ese.
- **Dedup intra-import:** mismo `proveedor + fecha + importe + concepto` normalizado.
- **Concepto:** se intenta mapear al catálogo de conceptos (exacto/contiene/fuzzy); si no, se
  guarda tal cual y se reporta en `conceptResolution.unmapped`.
- Página vacía → `Hoja vacía.`; fila sin proveedor ni concepto → se salta.

---

## 5. Cambios 2026-10-12

### Frontend (`facturacion-react`)

- `src/features/expenses/pages/ExpensesPage.tsx`
  - **Vista previa como popup a todo el ancho**, con tabla scrollable y confirmación en el pie.
    Cada fila tiene **✕ (Quitar)**; se importan **las que quedan**. Al confirmar se envía
    `selectedRowKeys` (claves de las filas restantes).
  - **Modales** de gasto/etiquetas: centrado robusto `fixed inset-0 m-auto` +
    `max-h-[min(92dvh, …)]` + `overflow-y-auto` (antes se recortaban por arriba al ser altos).
  - Popup: ancho `calc(100% - 1rem)` (evita el scroll horizontal de `100vw`) y `hidden open:flex`
    (un `<dialog>` cerrado con `flex` se dibuja como una línea fantasma a todo el ancho).
- `src/infrastructure/api/expensesApi.ts` — `importControlExpenses` acepta `selectedRowKeys`.
- `src/test/setup.ts` — el stub de `useMutation` pasa también `variables` a `onSuccess`
  (antes solo `data`, lo que ocultaba este flujo en los tests).
- Test: `ExpensesPage.test.tsx` → “import de Excel: la vista previa permite quitar filas antes de importar”.

### Backend (`facturacion`, `server.mjs`)

- `mapExpenseSheetColumn`: `Descripción` como concepto; abreviaturas de fecha de banco.
- `parseExpenseWorkbookIssueDate`: fecha en hora local.
- `importControlExpenseSpreadsheet`: respeta `selectedRowKeys` al persistir (omite las no marcadas).

---

## 6. Verificación

- `npm run build` (frontend) OK.
- `npx vitest run` → **97/97**.
- Backend `npm run test:smoke` → OK.
- Prueba real con dos extractos (Bankinter/Revolut y cuenta “Pear&co.”): cabecera detectada,
  fecha correcta y trimestre correcto.

---

## 7. Despliegue (importante)

El `/react` de producción se sirve desde `react-dist/` del Mac mini. **Históricamente se
construía desde el submódulo `facturacion/facturacion-react`, que puede divergir de este repo.**
En el despliegue de este cambio se construyó **este repo (`main`)** y se subió su `dist/` a
`~/facturacion-app/react-dist/`.

Si más adelante se vuelve a desplegar con el submódulo, comprobar que ambos apuntan a la misma
rama/commit para no revertir estas mejoras (`ExpensesPage` y `expensesApi`).

Rollback: backups en el mini en `~/agent-backups-20261012/` (copias de `react-dist/` y `server.mjs`).
