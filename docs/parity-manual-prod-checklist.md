# Checklist manual en producción (opción A)

**Objetivo:** cerrar filas `(parcial)` del [roadmap](./roadmap-paridad.md) y de las [matrices Facturar / Gastos](./facturar-field-parity-matrix.md) con **evidencia en el entorno real** (`facturacion.pearandco.es`), no solo con lectura de repo.

**Referencias previas (sin sustituir esta sesión):** [evidencia en `public/app.js`](./parity-partials-legacy-code-evidence.md).

---

## Antes de empezar

1. **URLs:** legacy `https://facturacion.pearandco.es/` · React `https://facturacion.pearandco.es/react/`
2. **Misma sesión / tenant:** mismo usuario y, si aplica, mismo perfil plantilla activo en ambas UIs.
3. **Nada destructivo** salvo que el caso lo exija; usa documentos/gastos de prueba o copias.
4. Al terminar cada fila: rellena **Fecha** y **Notas**; si OK, actualiza la fila correspondiente en el roadmap o en la matriz (`parcial` → `cerrado` o acota la brecha).

---

## Tabla de sesión (rellenar)

| # | Tema | Qué hacer en **legacy** | Qué hacer en **React** | Criterio OK | Fecha | OK | Notas |
|---|------|-------------------------|------------------------|-------------|-------|----|-------|
| 1 | Facturar — bloqueo guardado | Mismo borrador mínimo (cliente solo nombre, sin NIF; sin `dueDate`; sin serie si el flujo lo permite). Intentar guardar cuando falte número / IGIC / IRPF. | Repetir mismas omisiones: mismos tipos de error o mismo éxito al guardar. | Misma política de **qué** bloquea el guardado (mensajes o botón deshabilitado). | | ☐ | |
| 2 | Facturar — `dueDate` / API | Documento con vencimiento vacío: guardar. Luego abrir HTML/PDF oficial si puedes. | Igual en React. | Mismo resultado (acepta / rechaza / PDF sin error relevante). | | ☐ | |
| 3 | Facturar — `client.taxId` | Cliente sin NIF, resto mínimo válido: guardar y abrir salida oficial. | Igual. | Mismo comportamiento que legacy (acepta o mensaje API). | | ☐ | |
| 4 | Facturar — `series` | Cambiar serie (o dejarla vacía), guardar, recargar documento. | Igual. | Numeración y persistencia coherentes con legacy. | | ☐ | |
| 5 | Facturar — contabilidad extendida | Rellenar `paymentDate`, `quarter`, `invoiceId`, `netCollected`, `taxes` (los que use prod), guardar, recargar. | Misma secuencia en React. | Round-trip y formatos aceptados igual que legacy. | | ☐ | |
| 6 | Facturar — `paymentMethod` | Observar si es lista cerrada o texto libre; valor típico. | Mismo tipo de control y valor guardado. | Paridad de **modo** de entrada (catálogo vs libre). | | ☐ | |
| 7 | Facturar — IGIC “raro” | Valor no estándar (p. ej. 9,5 %) si el legacy lo permite guardar. | Mismo valor. | Mismo resultado POST / totales. | | ☐ | |
| 8 | Gastos — OR vendor/descripción | Solo descripción; solo proveedor; ambos vacíos (debe fallar en ambos). | Igual. | Mismos tres resultados. | | ☐ | |
| 9 | Gastos — `operationDate` / `issueDate` | Casos límite (una fecha vacía, orden con `normalizeExpenseDraft` legacy). | Igual en React. | Mismo criterio de error o guardado. | | ☐ | |
|10 | Gastos — IRPF/importes | `withholdingRate` / importes manuales fuera de 15/19/21 si legacy lo admite. | Igual. | Misma flexibilidad o mismo rechazo. | | ☐ | |
|11 | Historial / filtros | Filtro por año + texto + estado + perfil (lo que use el operador a diario). | Misma búsqueda en React. | Mismo subconjunto o diferencia explicable (p. ej. límite de lista). | | ☐ | |
|12 | Clientes ↔ Facturar | Crear/editar cliente en legacy; usar en factura. Repetir flujo inverso desde React. | Mismo flujo cruzado. | Matching y datos visibles alineados (nombre normalizado, NIF, etc.). | | ☐ | |

*(Marca **OK** cuando el criterio se cumple; en **Notas** enlaza captura, `recordId`, o mensaje de error exacto.)*

---

## Después de la sesión

1. Actualizar [roadmap-paridad.md](./roadmap-paridad.md): quitar o acotar bullets `(parcial)` que hayas cerrado; añadir fecha en la línea o en la nota.
2. Actualizar filas en [facturar-field-parity-matrix.md](./facturar-field-parity-matrix.md) / [gastos-field-parity-matrix.md](./gastos-field-parity-matrix.md): columna **Estado** y **Verificación**.
3. Si aparece **regresión solo en React**, abrir issue/tarea con pasos y `recordId`.

---

*Plantilla reusable: duplicar la tabla por sprint o por operador.*
