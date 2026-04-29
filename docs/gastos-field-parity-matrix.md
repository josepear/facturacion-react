# Matriz de paridad Gastos: Legacy vs React

**Referencia legacy:** `facturacion.pearandco.es` (no SaaS fallida).  
**Referencia React:** `ExpensesPage.tsx` (`src/features/expenses/pages/ExpensesPage.tsx`), `ExpenseRecord` / `ExpenseOptions` (`src/domain/expenses/types.ts`), `expensesApi.ts` (`src/infrastructure/api/expensesApi.ts`), configuración compartida `GET /api/config` vía `fetchRuntimeConfig`.

**Nota metodológica:** la columna «Legacy» describe el comportamiento esperable en producción; las filas con «validar en legacy» quedan en estado **parcial** hasta checklist manual.

**Leyenda:** `cerrado` · `parcial` · `pendiente` — **Pri.** P0 / P1 / P2

---

## 1. Proveedor (vendor)

| Campo / bloque | Legacy (ref.; validar) | React actual | Brecha exacta | Implementación sugerida | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `vendor` | Típicamente obligatorio o fuerte convención operativa | Input + `datalist` alimentado por `expenseOptions.vendors` | Validación React: basta `vendor` **o** `description`; legacy puede exigir proveedor siempre | Alinear reglas con legacy / backend | Guardar mismos casos límite que prod | **parcial** | P1 |
| `taxIdType` | Tipo de identificación fiscal del proveedor | Input en «Más campos del gasto» | «validar en legacy» catálogo/forma | — | Guardar/recargar conserva valor | **parcial** | P2 |
| `taxCountryCode` | País fiscal del proveedor (código) | Input `maxLength=2` en «Más campos del gasto» | «validar en legacy» formato/obligatoriedad | — | Guardar/recargar conserva valor en mayúsculas | **parcial** | P2 |

---

## 2. Categoría

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `category` | Lista o texto según legacy | Input + `datalist` con `expenseOptions.categories` | Si legacy usa solo lista cerrada, el input libre + datalist permite valores fuera de catálogo | Select estricto si aplica | Mismos valores rechazados/aceptados | **parcial** | P1 |

---

## 3. Número factura

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `invoiceNumber` | Campo principal nº factura | Input en formulario | — | — | Recarga conserva valor | **cerrado** | P1 |
| `invoiceNumberEnd` | Rango / segundo nº si legacy lo usa | `<details>` «Más campos del gasto» | «validar en legacy» formato | — | Paridad con legacy | **parcial** | P1 |

---

## 4. Fechas

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `issueDate` (fecha factura) | Obligatoria según política | `type="date"` | Validar obligatoriedad vs backend/legacy | Zod o validación previa a POST | Error claro si falta | **parcial** | P1 |
| `operationDate` | Fecha de operación / devengo si aplica | `type="date"` en «Más campos del gasto» | «validar en legacy» obligatoriedad | — | Igual que legacy | **parcial** | P1 |

---

## 5. Descripción y concepto

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `description` | Texto libre | Input | — | — | — | **cerrado** | P1 |
| `expenseConcept` | Concepto contable / etiqueta si legacy distingue | Input en «Más campos del gasto» | Duplicidad semántica con `description` | — | Legacy muestra ambos | **parcial** | P2 |

---

## 6. Subtotal / impuestos / retención / total

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `subtotal` | Base imponible | Input numérico | — | — | Total cuadra | **cerrado** | P0 |
| `taxRate` / `taxAmount` | IGIC u otro | Input %; `taxAmount` recalculado en `normalizeExpenseDraft` (no editable directo) | Si legacy permite importe impuesto manual | Campo o reglas explícitas | Mismo redondeo que prod | **parcial** | P1 |
| `withholdingRate` / `withholdingAmount` | IRPF retención | Input %; importe derivado en normalización | Validar % permitidos vs legacy (catálogo) | Restringir como Facturar si aplica | — | **parcial** | P1 |
| `total` | Resultado | Solo lectura en UI (derivado) | Si legacy permite editar total manual | — | — | **parcial** | P2 |

---

## 7. Perfil (`templateProfileId`)

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `templateProfileId` | Gasto asociado a perfil / tenant | Select desde `GET /api/config` (`templateProfiles`); opción vacía «Perfil por defecto» | Coherencia con **Configuración** (`activeTemplateProfileId`): nuevo gasto usa `activeProfileId` en `createEmptyExpense` | Alinear copy y default con legacy | Mismo perfil por defecto que prod | **parcial** | P1 |
| `templateProfileLabel` | Solo lectura en listados legacy | Mostrado en listado (`Perfil: ...`) con fallback a `templateProfileId` | Informativo | — | Ver listado con datos API | **parcial** | P2 |

---

## 8. Año y filtros

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Filtro por año | Por ejercicio | `yearFilter` vs `item.year` de `GET /api/expenses` | Si legacy filtra por más criterios | Ampliar filtros | — | **parcial** | P2 |
| Búsqueda texto | Proveedor, etc. | Término en vendor, description, category, invoiceNumber, recordId | Cobertura distinta a legacy | Ajustar campos indexados | Mismos hallazgos | **parcial** | P2 |

---

## 9. Archivo / eliminación / ciclo de vida

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Archivar gasto | Mover a papelera / archivo | `POST /api/expenses/archive` con `recordId` | «validar en legacy» etiquetas y efectos secundarios | — | Documento/gasto en mismo estado | **parcial** | P1 |
| Archivar ejercicio | Por año + perfil | `POST /api/expenses/archive-year` desde UI | — | — | Mismo alcance que legacy | **parcial** | P1 |
| Papelera — borrado permanente | Admin | `deleteTrashEntries` + `fetchTrash`; filtro `category === "gastos"`; solo admin habilitado | Restauración no soportada (texto UI) | API restore si existe | — | **parcial** | P1 |

---

## 10. Edición / recarga

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cargar gasto existente | Abrir por id / lista | Click en listado → `setDraft(normalizeExpenseDraft(item))` | Sin URL profunda `?recordId=` como Facturar | Deep link opcional | Bookmark/share igual que legacy | **pendiente** | P2 |
| Guardar create vs update | Distinción clara | `saveExpense` con `recordId` opcional; mensaje created/updated | — | — | Respuesta API coherente | **cerrado** | P1 |

---

## 11. `/api/expense-options`

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vendors / categories | Listas sugeridas | `fetchExpenseOptions` → `expenseOptions` anidado | Runbook/global-setup: respuesta a veces **no estándar** (`expenseOptions` wrapper) | Normalizar en backend o adaptador único | E2E/setup tolerante documentado | **parcial** | P1 |
| Otros ejes (si legacy) | Métodos pago, proveedores bloqueados, etc. | Solo `vendors` y `categories` en tipo `ExpenseOptions` | Si legacy expone más listas | Ampliar tipo + UI | — | **pendiente** | P2 |

---

## 12. Errores y permisos

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Errores de guardado | Mensajes claros | `statusMessage` + `ApiError` vía `request()` | Mapeo 4xx/5xx a texto usuario | Mejorar mensajes desde payload | — | **parcial** | P2 |
| Rol admin | Restricciones en papelera | `currentUser.role === "admin"` para borrar papelera | Archivar gasto/ejercicio **no** comprueba admin en UI (solo papelera) | Alinear con política legacy | Usuario no-admin no archiva si no debe | **parcial** | P1 |

---

## 13. Relación con Configuración

| Campo / bloque | Legacy (ref.) | React actual | Brecha exacta | Implementación | Verificación | Estado | Pri. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Perfil activo | Defaults nuevos gastos | `activeTemplateProfileId` para `createEmptyExpense` y listas de archivo por perfil | Mismo origen que Facturar (`/api/config`) | — | Cambiar perfil activo en Settings refleja en nuevo gasto | **cerrado** | P1 |

---

## 14. Campos en `ExpenseRecord` sin input en Gastos (resumen)

| Campo | En UI React | Estado matriz | Pri. |
| --- | --- | --- | --- |
| `operationDate` | Sí («Más campos del gasto») | **parcial** | P1 |
| `taxIdType` | Sí («Más campos del gasto») | **parcial** | P2 |
| `taxCountryCode` | Sí («Más campos del gasto») | **parcial** | P2 |
| `invoiceNumberEnd` | Sí | **parcial** | P1 |
| `expenseConcept` | Sí | **parcial** | P2 |
| `quarter` | Sí (texto libre) | **parcial** | P1 |
| `nextcloudUrl` | Sí (`type="url"`) | **parcial** | P1 |
| `tenantId`, `savedAt`, `updatedAt`, `id` | No (metadatos / servidor) | **parcial** (solo si legacy los edita) | P2 |

---

## Resumen brechas por prioridad

### P0 (operación diaria crítica)

- **Listado + alta/edición mínima + fiscalidad básica + guardado** operativos en React respecto al contrato actual.  
- **E2E smoke Gastos — Fase B verificada (2026-04-28):** `e2e/expenses-flow.spec.ts` ejecutado con  
  `npx playwright test e2e/expenses-flow.spec.ts --project=chromium --workers=1 --timeout=45000` → **2 passed** (setup + smoke). Cobertura: autenticación real, `/gastos`, shape `/api/expense-options`, prefijo `E2E-GASTO-*`, dos `POST /api/expenses` OK + `recordId`, limpieza vía `POST /api/expenses/archive` (en código: `Response.ok` es **propiedad**, no método). Selector del título: `heading` con **`exact: true`** para no chocar con «Listado de gastos» / «Papelera gastos». Harness: `e2e/browserApiHarness.ts`.

### P1

1. Alinear con legacy: obligatoriedad de `vendor` / `issueDate`, formato de `quarter`, y checklist manual de los campos en «Más campos del gasto».  
2. **Permisos:** papelera solo admin; revisar si archivar debe estar restringido igual.  
3. **`/api/expense-options`:** forma de respuesta y riqueza de listas vs legacy.  
4. **IRPF / IGIC:** alinear catálogos y redondeo con legacy.

### P2

- filtros avanzados, deep links, total manual, reporting.

---

## Criterio de cierre del documento

- **Estado global:** **parcial** — matriz accionable; cobertura E2E del happy path Gastos **cerrada**; filas legacy pendientes de contrastar en prod siguen explícitas.  
- **Cerrado** (documento completo) cuando el equipo marque cada fila tras checklist en `facturacion.pearandco.es`.

---

*Solo documentación; sin secretos.*
