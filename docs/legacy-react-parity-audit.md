# Auditoría de paridad Legacy → React (facturación)

**Alcance:** comparación funcional y operativa entre la aplicación de referencia en producción (`facturacion.pearandco.es`, UI legacy actual) y la nueva app React de este repo. **No** se usa la SaaS fallida como referencia.

**Fuentes para esta auditoría (sin acceso a secretos):**

- Código React actual: rutas, páginas y APIs en `src/`.
- Contratos HTTP consumidos por React (`/api/...`) según `src/infrastructure/api/*`.
- Runbook E2E: `docs/e2e-facturar-critical-flow-runbook.md` (diagnóstico operativo local vs backend real).
- Mapa de reutilización: `docs/phase-0-reuse-map.md`.
- Matriz Facturar (campos / bloques): `docs/facturar-field-parity-matrix.md`.
- Matriz Gastos (campos / bloques): `docs/gastos-field-parity-matrix.md`.

**Limitación explícita:** el detalle pixel-a-pixel y cada atajo de teclado del legacy no se inventan; donde el código React no expone una capacidad que el legacy suele tener en producción, la brecha se marca **pendiente** y la verificación exige **checklist manual en legacy**.

**Criterio por brecha (tabla repetida en cada sección):**

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |

**Estados:** `cerrado` · `parcial` · `pendiente`

---

## Resumen ejecutivo

- React ya cubre **cinco módulos** con datos reales: Facturar, Clientes, Historial, Gastos, Configuración (`src/app/router.tsx`).
- La paridad **no** es solo pantalla: depende de que el navegador reciba **JSON** de `/api/*` (auth + proxy). **P0-1 (proxy):** cerrado en repo: `vite.config.ts` aplica el mismo proxy a `server` (dev) y `preview`; el fallo típico era `vite preview` sin proxy (HTML de SPA en `/api/*`). Ver README «API en desarrollo local».
- **Gastos** y **Historial** declaran explícitamente límites de papelera (restauración no soportada por contrato actual en UI).
- **Facturar — P0-2 (flujo diario):** el camino acordado *crear → guardar → recargar → editar → salida HTML/PDF* está cubierto por E2E y por el modelo actual; la **paridad campo a campo** frente al legacy está desglosada en `docs/facturar-field-parity-matrix.md` (estado global de esa matriz: **parcial**, pendiente validación manual en prod en filas marcadas).
- **Facturar — brechas P1 destacadas (desde la matriz):** sin UI para parte de `accounting.*` (p. ej. `paymentDate`), sin input para `client.contactPerson`, catálogos texto libre vs legacy, histórico reciente capado a 40, comprobación PDF por entorno.
- **Gastos — matriz de campos:** `docs/gastos-field-parity-matrix.md` (estado global **parcial** por checklist legacy campo a campo). **Smoke E2E (Fase B OK, 2026-04-28):** `e2e/expenses-flow.spec.ts` pasa contra backend real (`playwright test …expenses-flow.spec.ts`, proyecto chromium). Paridad matriz vs legacy sigue **parcial**; cobertura de regresión del happy path Gastos **cerrada** a nivel E2E. Brechas P1 restantes: campos `ExpenseRecord` sin UI, validación proveedor/fecha vs legacy, permisos archivo vs papelera, riqueza de `/api/expense-options` más allá del smoke. P2: concepto separado, deep links, filtros avanzados.

---

## Facturar

**Legacy (referencia producción):** flujo único de emisión/edición de documentos (factura/presupuesto), con datos de emisor por perfil, cliente, líneas, fiscalidad, numeración, guardado, recarga por identificador y acceso a salida oficial (HTML/PDF según backend).

**React actual:** `FacturarPage` + `useFacturarForm`: carga `GET /api/config`, clientes `GET /api/clients`, histórico reciente `GET /api/history`, detalle `GET /api/documents/detail`, guardado `POST /api/documents`, numeración `GET /api/next-number` y validación de número; checklist de módulos; preview en vivo; enlaces a HTML/PDF oficial tras guardar/cargar.

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |
| Operación estable en navegador contra el mismo host que sirve la API | Vite **dev** y **preview** reenvían `/api` al backend (`vite.config.ts`, variable opcional `E2E_API_TARGET`) | **Condición de fallo histórica:** `vite preview` no heredaba `server.proxy`, así que `GET /api/config` devolvía `index.html` (200) en lugar de JSON | Proxy unificado `server` + `preview` + documentación README (curl de smoke) | `curl …/api/config \| head -c 80` no empieza por `<`; Network en `/facturar` muestra JSON | **cerrado** |
| Paridad de todos los campos y reglas de negocio del formulario legacy | Formulario React acotado al modelo `InvoiceDocument` + validaciones Zod y checklist propia | Brechas puntuales inventariadas (contabilidad extendida, `contactPerson`, catálogos, límites histórico, etc.); varias filas legacy requieren checklist en prod | Seguir `docs/facturar-field-parity-matrix.md`; implementar por prioridad P0/P1/P2 allí definida | Cerrar filas `pendiente`/`parcial` en la matriz con evidencia en legacy | **parcial** |
| Flujos posteriores al guardado (envío, duplicar, anular, etc., si existen en legacy) | Botones centrados en guardar y abrir HTML/PDF oficial | Acciones post-guardado del legacy no reflejadas en UI React | Añadir acciones que llamen a los mismos endpoints legacy (si existen) o documentar exclusión | Checklist en legacy y reproducción en React | **pendiente** |

---

## Clientes

**Legacy (referencia producción):** mantenimiento de clientes reutilizables en facturación (alta, edición, listado, búsqueda).

**React actual:** `ClientsPage`: listado + búsqueda local, selección, formulario con campos alineados a `ClientRecord`, guardado vía API de clientes (`fetchClients` / `saveClient` en `clientsApi.ts`).

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |
| CRUD y búsqueda operativa | CRUD mínimo + filtro en memoria | Paginación, ordenación, filtros avanzados o acciones masivas si legacy las tiene | Replicar comportamiento tras inventario en legacy | Probar volúmenes y filtros equivalentes | **pendiente** |
| Eliminación / archivo / merge de duplicados (si aplica en legacy) | No hay acciones de borrado o fusión visibles en la página | Brecha de ciclo de vida respecto a legacy | Exponer las mismas operaciones que el backend permita | Misma operación en legacy y React con mismo resultado en datos | **pendiente** |
| Coherencia con Facturar (autocompletar, IDs) | Facturar consume el mismo listado de clientes vía React Query | Paridad rota si el legacy usa otro criterio de matching (p. ej. normalización de nombre) | Ajustar mapeo `applyClientByName` / opciones según comportamiento legacy | Crear cliente en módulo y usarlo en Facturar como en legacy | **parcial** |

---

## Historial

**Legacy (referencia producción):** listado de documentos emitidos, apertura, re-edición, archivado y gestión de residuos según rol.

**React actual:** `HistoryPage`: `GET /api/history`, detalle `GET /api/documents/detail`, navegación a `/facturar?recordId=...`, HTML oficial, archivado unitario y por ejercicio, papelera con borrado permanente para admin; texto explícito: restauración no soportada por contrato actual.

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |
| Restaurar desde papelera (si legacy lo permite) | UI indica que restauración no está soportada | Usuario admin no puede restaurar desde React como en legacy | Backend + UI de restore si el contrato legacy lo expone; si no existe API, alinear expectativas | Caso restore en legacy reproducido | **pendiente** |
| Abrir PDF oficial desde listado | Botón “Ver HTML oficial”; PDF no enlazado igual que en Facturar | Paridad de accesos a salidas (HTML vs PDF) desde Historial | Reutilizar patrón de URLs de Facturar o endpoint legacy de PDF | Mismo `recordId` abre misma salida que legacy | **pendiente** |
| Filtros por fechas, tipo, estado, perfil (si legacy) | Búsqueda por texto sobre lista cargada | Filtrado menos rico que legacy | Ampliar query o filtros cliente según `GET /api/history` | Mismos filtros y conteos que legacy | **pendiente** |

---

## Gastos

**Legacy (referencia producción):** registro de gastos con proveedor, fiscalidad, vínculos (p. ej. Nextcloud), cuatrimestres, archivado y papelera coherente con documentos.

**React actual:** `ExpensesPage`: listado `GET /api/expenses`, opciones `GET /api/expense-options`, guardado `POST /api/expenses`, archivar gasto y archivar ejercicio, papelera con borrado permanente para admin; perfiles desde `GET /api/config`. Detalle campo a campo y prioridades en **`docs/gastos-field-parity-matrix.md`**.

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |
| Paridad exhaustiva de campos y reglas vs legacy | Subconjunto de `ExpenseRecord` en formulario; validación local distinta (p. ej. `vendor` **o** `description`) | Ver matriz: campos sin UI, catálogos, permisos, `expense-options` | Implementar por filas P1/P2 de `docs/gastos-field-parity-matrix.md` | Checklist prod fila a fila | **parcial** |
| Restaurar gastos desde papelera | UI: restauración no soportada por contrato | Brecha operativa | API + UI si legacy lo tiene | Caso restore | **pendiente** |
| Informes / exportación (si legacy) | No en página | Brecha de reporting | Solo si legacy y API | Export igual | **pendiente** |

**Brechas resumidas (prioridad):**

- **P1:** campos modelo sin pantalla (`operationDate`, `invoiceNumberEnd`, `quarter`, `nextcloudUrl`, …), alinear obligatoriedad y permisos de archivo, normalización `/api/expense-options` avanzada.
- **P2:** `expenseConcept`, deep link a gasto, filtros avanzados, reporting.
- **E2E:** smoke Gastos en `e2e/expenses-flow.spec.ts` (ver runbook / matriz Gastos).

---

## Configuración

**Legacy (referencia producción):** ajuste de perfiles de emisor, perfil activo, defaults fiscales y datos de negocio visibles en facturación.

**React actual:** `SettingsPage`: lectura `GET /api/config`, persistencia `POST /api/template-profiles`, selección de perfil activo y edición de campos principales del perfil; no-admin en solo lectura para guardar.

| legacy (referencia) | React actual | Brecha exacta | Implementación para cerrar | Verificación de cierre | Estado |
| --- | --- | --- | --- | --- | --- |
| Toda la matriz de ajustes del legacy (usuarios, integraciones, series, etc.) | Pantalla centrada en perfiles y defaults publicados en `/api/config` | Resto de ajustes legacy no presentes | Inventario de pantallas legacy vs rutas React; nuevas secciones o enlaces a legacy temporalmente | Cada ajuste crítico tiene camino en React o decisión explícita | **pendiente** |
| Cambiar perfil activo sin ser admin (si legacy permite) | Guardar requiere rol admin según UI | Brecha de permisos respecto a legacy | Ajustar según política real del backend | Usuario no-admin reproduce flujo legacy | **pendiente** |

---

## P0 críticas (bloquean operación diaria o datos)

| ID | Brecha | Impacto | Verificación mínima |
| --- | --- | --- | --- |
| P0-1 | **Cerrado.** Antes: sin proxy en `preview`, `/api/*` podía devolver HTML de la SPA. Ahora: mismo `apiProxy` en `server` y `preview` (`vite.config.ts`); README describe smoke `curl` y `E2E_API_TARGET`. E2E: el navegador ya reenvía `/api/*` al backend vía Playwright (runbook). | Sin JSON en `/api/*` en local, Facturar parece “vacío” | `npm run dev` o `npm run preview` + `curl` (cuerpo no empieza por `<`); `npm run test:e2e` |
| P0-2 | **Camino feliz cerrado** (create → save → reload → edit + HTML/PDF) vía E2E y modelo actual. **Paridad exhaustiva de campos:** seguir matriz Facturar (`docs/facturar-field-parity-matrix.md`); brechas restantes son sobre todo **P1** (UI contabilidad, contacto, catálogos), no el happy path | Datos incompletos vs legacy al editar campos no expuestos en UI | `npm run test:e2e` + matriz actualizada con checklist legacy |
| P0-3 | Auth: token en `localStorage` y cabecera `Authorization` en todas las llamadas API | Listas vacías o 401 silenciosos | Interceptar request y confirmar Bearer |

---

## P1 importantes (operación frecuente o compliance)

| ID | Brecha | Notas |
| --- | --- | --- |
| P1-1 | Gastos: modelo completo vs formulario reducido (detalle en `docs/gastos-field-parity-matrix.md`) | Riesgo de datos incompletos respecto a legacy |
| P1-2 | Historial: sin restauración desde papelera en UI | Admins dependen de legacy o de procedimiento manual |
| P1-3 | Historial: acceso PDF vs HTML puede diferir de Facturar | Revisar URLs y expectativas de usuario |
| P1-4 | Clientes: posibles acciones de ciclo de vida ausentes | Depende de qué exponga legacy |

---

## P2 secundarias (eficiencia, UX, reporting)

| ID | Brecha |
| --- | --- |
| P2-1 | Filtros avanzados en Historial y Gastos |
| P2-2 | Paginación y rendimiento en listas grandes |
| P2-3 | Atajos, mensajes de error más ricos, tooltips de negocio |

---

## Riesgos / No tocar

- **No** usar la SaaS fallida como referencia funcional (`phase-0-reuse-map.md`).
- **No** incluir tokens, contraseñas ni secretos en documentación o trazas.
- **No** modificar el flujo E2E protegido sin proceso explícito (runbook).
- **Backend:** no cambiar salvo bloqueo demostrado; varias brechas (papelera restore) pueden ser **solo frontend** o **requerir API**: distinguir antes de implementar.
- **Datos reales:** pruebas contra producción pueden crear documentos/gastos reales; usar prefijos y cuenta de prueba acordada.

---

## Siguiente paso recomendado (fuera de este documento)

1. Checklist manual en `facturacion.pearandco.es` módulo por módulo (una sesión por área).
2. Completar validación legacy fila a fila en `docs/facturar-field-parity-matrix.md` y `docs/gastos-field-parity-matrix.md`.
3. ~~Priorizar P0-1~~ **P0-1 cerrado** (proxy dev+preview + documentación); mantener el smoke `curl` al cambiar puertos o scripts de arranque.

---

*Documento generado como auditoría; no implica implementación.*
