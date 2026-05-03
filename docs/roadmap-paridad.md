# Roadmap de paridad Legacy -> React

Tablero operativo para seguir el cierre de paridad contra `facturacion.pearandco.es`.

## Cómo leer este documento

- `[x]` hecho en el código actual del repo o en la rama de trabajo validada.
- `[ ]` pendiente.
- `(parcial)` hecho en parte, pero aún necesita checklist manual en legacy, reglas confirmadas o backend.

Este roadmap resume y fiscaliza lo que ya está inventariado con más detalle en:

- [legacy-react-parity-audit.md](/Volumes/RAID/Repos/apps/facturacion/facturacion-react/docs/legacy-react-parity-audit.md)
- [facturar-field-parity-matrix.md](/Volumes/RAID/Repos/apps/facturacion/facturacion-react/docs/facturar-field-parity-matrix.md)
- [gastos-field-parity-matrix.md](/Volumes/RAID/Repos/apps/facturacion/facturacion-react/docs/gastos-field-parity-matrix.md)

---

## P0 transversal

- [x] Proxy `/api/*` unificado en local para `dev` y `preview`.
- [x] Flujo feliz de Facturar cerrado: crear -> guardar -> recargar -> editar -> HTML/PDF.
- [x] Smoke E2E de Gastos contra backend real.
- [x] **Identidad y permisos en React** vía `GET /api/session` (rol, `tenantId` de sesión). **`GET /api/config`** solo para datos de negocio compartidos (`templateProfiles`, `activeTemplateProfileId`, defaults, metadatos de runtime); la SPA no usa `currentUser` del JSON de config para rol ni tenant.
- [x] Checklist manual sistemático contra legacy en producción para cerrar filas marcadas como parciales.
- [x] **App React desplegada en producción** en `https://facturacion.pearandco.es/react/` servida por el mismo servidor Node legacy (`serveReactApp` en `server.mjs`, ruta pública `/react/*`). Deploy integrado en `deploy-to-macmini.sh --local`.
- [x] **Gestión de miembros del sistema** en Configuración: lista de usuarios, crear, editar y borrar vía `GET/POST /api/users`.
- [x] **Exportación y vista compartida en React:** uso de `POST /api/accounting/export`, `POST /api/control-workbook-export` y `POST /api/share-reports` según `server.mjs` (Gastos e Historial).

---

## Facturar

### Hecho

- [x] Selector de perfil plantilla operativo.
- [x] Contexto visible de `tenantId`.
- [x] `templateLayout` editable/soportado por mapper.
- [x] `number`, `numberEnd`, `issueDate`, `reference` operativos.
- [x] Estado contable base `accounting.status`.
- [x] `client.contactPerson` visible y editable.
- [x] Carga por `recordId`, recarga manual y visibilidad de `recordId`.
- [x] HTML/PDF oficial con flujo operativo cerrado.
- [x] Histórico en Facturar mejorado:
  - [x] filtro por tipo
  - [x] filtro por ejercicio
  - [x] búsqueda mejorada
  - [x] limpiar filtros
  - [x] selección rápida con más contexto (tipo, importe, fecha)
  - [x] límite ampliado a 100 recientes con enlace al Historial completo
- [x] **Presets IGIC:** botones 0 %, 3 %, 7 %, 15 % junto al campo IGIC (%) en el panel de impuestos.
- [x] **Duplicar documento:** botón "Duplicar documento" (visible solo cuando hay un documento cargado); copia todos los datos, borra número y `recordId` para guardar como nuevo.
- [x] **`lineTotal` manual por línea:** campo "Total línea" en cada concepto; cuando se informa, prevalece sobre cantidad × precio.
- [x] **Tipos de documento adicionales:** no aplican por contrato actual (backend legacy resuelve solo `factura` y `presupuesto`).
- [x] **Aviso de cambios no guardados:** useBlocker (navegación interna) + beforeunload (pestaña/refresco).

### Parcial

- [ ] (parcial) `applyTemplateProfile` alineado al 100% con defaults del legacy.
- [ ] (parcial) Metadatos de perfil en solo lectura: confirmar si legacy muestra más contexto.
- [ ] (parcial) `paymentMethod`: confirmar si debe ser catálogo cerrado.
- [ ] (parcial) `series`: confirmar obligatoriedad/regla exacta.
- [ ] (parcial) `accounting.paymentDate`: expuesto y con round-trip, pero sin regla estricta confirmada.
- [ ] (parcial) `accounting.quarter`: expuesto y persistente, pendiente validación de formato/regla.
- [ ] (parcial) `accounting.invoiceId`: expuesto y persistente, pendiente validación de formato/regla.
- [ ] (parcial) `accounting.netCollected`: expuesto y persistente, pendiente validación de negocio.
- [ ] (parcial) `accounting.taxes`: expuesto y persistente, pendiente checklist legacy.
- [ ] (parcial) `dueDate`: confirmar obligatoriedad real.
- [ ] (parcial) `client.taxId`: confirmar obligatoriedad exacta.
- [ ] (parcial) `client.taxCountryCode`: confirmar si debe ser lista/ISO cerrada.
- [ ] (parcial) `client.taxIdType`: confirmar si debe ser catálogo.
- [ ] (parcial) `totalsBasis`: confirmar etiquetas y reglas exactas frente a legacy.
- [ ] (parcial) `taxRate`: confirmar topes/catálogo — presets IGIC añadidos (0 %, 3 %, 7 %, 15 %); valor libre sigue disponible.
- [ ] (parcial) Preview local frente a HTML oficial/pixel-perfect.
- [ ] (parcial) PDF oficial: confirmar disponibilidad estable en todos los entornos.

### Pendiente

- [x] **Duplicar documento:** implementado en cliente (ver Hecho arriba).

---

## Historial

### Hecho

- [x] Abrir en Facturar por `recordId`.
- [x] Abrir HTML/PDF oficial desde Historial.
- [x] Panel de detalle más útil:
  - [x] `recordId` visible
  - [x] copiar `recordId`
  - [x] estado contable visible
  - [x] perfil plantilla visible cuando existe
  - [x] `templateLayout` visible cuando existe
- [x] Mejor ergonomía de filtros:
  - [x] distinguir API vacía vs filtros sin resultados
  - [x] botón `Limpiar filtros`
  - [x] persistencia de filtros en URL (`q`, `type`, `year`)
- [x] Deep link de selección en Historial:
  - [x] `?recordId=...` para abrir detalle directo
- [x] Microcopy operativo para reforzar el flujo con Facturar.
- [x] **Filtros por estado contable y perfil de plantilla:** dropdowns con persistencia en URL (`?status=...&profile=...`); texto de búsqueda ampliado a `templateProfileLabel`; cada fila del listado muestra perfil y estado.
- [x] **Vista compartida (solo lectura):** `POST /api/share-reports` con URL devuelta por el servidor, campo de solo lectura y copiar al portapapeles (filtros de año y estado contable del listado se envían en el cuerpo).

### Parcial

- [ ] (parcial) Rangos de fecha y otros filtros avanzados si legacy los exige.

### Pendiente

- [ ] Restaurar desde papelera si el legacy/backend lo permite.

---

## Clientes

### Hecho

- [x] CRUD mínimo utilizable.
- [x] Búsqueda local básica.
- [x] Integración base con Facturar para selección/autocompletado.
- [x] Búsqueda local ampliada (contacto, ciudad, provincia, `recordId` además de nombre/NIF/email).
- [x] Contexto útil en filas del listado cuando los datos vienen informados (email, persona de contacto, ciudad/provincia).
- [x] Contador operativo `Mostrando N de M` y acción `Limpiar búsqueda` cuando hay texto de filtro.
- [x] Persistencia de contexto en URL: `q` (búsqueda) y `recordId` (selección); al elegir cliente o guardar, se sincroniza `recordId`; deep link `?recordId=...` abre el cliente en el formulario.
- [x] `recordId` del cliente visible en el formulario al editar (misma pieza que usa Facturar vía listado/API).
- [x] **Archivado de cliente desde UI:** acción `Archivar cliente` conectada a `POST /api/clients/archive` con invalidación de listado y feedback de estado.
- [x] **Coherencia de matching con Facturar:** normalización de nombre (acentos, mayúsculas/minúsculas y espacios) para vincular cliente guardado al editar documento.
- [x] **Búsqueda más robusta en Clientes:** filtro local normalizado (texto y NIF/CIF) para mejorar coincidencias.
- [x] **Ordenación cliente-lado (por nombre, por país, orden original) y filtro por país con persistencia en URL.**

### Parcial

- [ ] (parcial) Coherencia exacta con Facturar si legacy usa otro criterio adicional de matching (p. ej., prioridad por NIF o reglas de desempate).

### Pendiente

- [ ] Paginación y filtros/ordenación en servidor o más ricos si legacy los tiene.
- [ ] Ciclo de vida avanzado: fusión, desarchivado o gestión de duplicados si existen en legacy.

---

## Gastos

### Hecho

- [x] Happy path de crear/editar/guardar cubierto.
- [x] `taxIdType` visible en edición.
- [x] `taxCountryCode` visible en edición.
- [x] `templateProfileLabel` visible en listado.
- [x] `year` visible como contexto de edición.
- [x] Contexto visible en listado:
  - [x] `quarter`
  - [x] `operationDate`
  - [x] `paymentMethod`
  - [x] `deductible`
- [x] Ergonomía de listado/filtros:
  - [x] contador `Mostrando N de M`
  - [x] limpiar filtros
  - [x] filtro por perfil
  - [x] búsqueda ampliada
- [x] Deep link y contexto en URL:
  - [x] `?recordId=...`
  - [x] persistencia de `q`, `year`, `profile`
- [x] **`GET /api/expense-options`:** adaptador único en cliente que normaliza variantes de JSON (raíz, `expenseOptions`, `data`) a listas estables de proveedores y categorías para datalists.
- [x] **Perfil en alta de gasto:** borrador alineado con `activeTemplateProfileId` de `/api/config` cuando el usuario no ha elegido otro perfil; copy del selector y texto de ayuda que enlazan con Configuración; valor vacío = perfil activo del servidor.
- [x] **Errores al guardar:** mensajes de fallo de `POST /api/expenses` reutilizan `ApiError` y campos típicos del cuerpo (`message`, `detail`) para mostrar el texto del backend cuando existe.
- [x] **Importes manuales IGIC/IRPF:** `taxAmount` y `withholdingAmount` editables directamente; el % recalcula el importe pero el usuario puede sobreescribirlo.
- [x] **`issueDate` obligatoria:** validación cliente antes de `POST /api/expenses`; hint visual en el campo.
- [x] **`paymentMethod` datalist:** sugerencias (Transferencia bancaria, Tarjeta, Domiciliación, Efectivo, PayPal).
- [x] **Archivar solo admin:** botones "Archivar gasto" y "Archivar ejercicio" ocultos para no-admin en UI.
- [x] **Hints de claridad:** `vendor` ("Requerido si no hay descripción"), `description` ("Si se rellena, proveedor opcional"), `expenseConcept` ("Etiqueta contable; distinto de descripción").
- [x] **`taxIdType` datalist:** NIF, CIF, NIE, Pasaporte, VAT.
- [x] **`taxCountryCode` datalist:** ES, PT, FR, DE, IT, GB, NL, US, MX, AR, CN.
- [x] **Exportación contable:** `POST /api/accounting/export` (Excel asesoría / Celia) y `POST /api/control-workbook-export` (libro de control Excel) desde la pantalla Gastos, con descarga en el navegador.

### Parcial

- [ ] (parcial) `vendor`: confirmar obligatoriedad real frente a legacy/backend.
- [ ] (parcial) `category`: confirmar si debe ser lista cerrada.
- [ ] (parcial) `invoiceNumberEnd`: confirmar formato/regla legacy.
- [ ] (parcial) `operationDate`: visible, pero pendiente checklist de obligatoriedad/regla.
- [ ] (parcial) `withholdingRate` / `withholdingAmount`: pendiente confirmar catálogo/regla.
- [ ] (parcial) `total`: confirmar si legacy permite edición manual.
- [ ] (parcial) `templateProfileId`: checklist legacy frente a comportamiento exacto al guardar con perfil vacío vs explícito.
- [ ] (parcial) Filtros adicionales si legacy los exige.
- [ ] (parcial) `/api/expense-options`: confirmar riqueza/normalización frente a legacy.

### Pendiente

- [ ] Restaurar desde papelera si el contrato backend lo soporta.

---

## Miembros / Usuarios / Emisor

### Hecho

- [x] La pantalla distingue claramente:
  - [x] modo solo lectura por rol no admin (rol desde `GET /api/session`)
  - [x] fallo real de autenticación (`401/403` en `GET /api/config` o `GET /api/session`)
- [x] Flujo de “Nuevo usuario” verificado como existente cuando hay sesión válida y rol admin.
- [x] Mejor copy operativo para el estado de solo lectura.
- [x] Aviso explícito de **cambios locales pendientes de guardar** (campos editados, perfil activo distinto del último guardado, altas/bajas de perfil solo en memoria).
- [x] Resumen **Perfil activo (servidor)** alineado al último `activeTemplateProfileId` guardado; aviso si la selección de activo en el formulario aún no está fijada en servidor.
- [x] **Deep link / URL:** `GET /configuracion?templateProfileId=…` abre ese perfil en el formulario; al cambiar perfil se sincroniza el mismo parámetro que usa Facturar.

### Parcial

- [ ] (parcial) El módulo solo cubre una parte de la configuración legacy publicada por `/api/config`.

### Hecho (Configuración)

- [x] **Catálogo de gastos (`expenseOptions`):** sección admin para editar listas de proveedores y categorías vía `POST /api/expense-options`; solo lectura para no-admin.
- [x] **Edición de miembro inline:** formulario de edición se despliega debajo del usuario concreto en lugar de al final de la lista.
- [x] **Papelera admin:** sección visible solo para administradores con `GET /api/trash`, vaciado global (`POST /api/trash/empty`) y borrado selectivo (`POST /api/trash/delete`).

### Pendiente

- [ ] Inventario y cierre del resto de ajustes de configuración del legacy.
- [ ] Confirmar si el legacy permite cambiar perfil activo sin ser admin.

---

## Qué queda para después

- [ ] Restauraciones desde papelera dependientes de backend.
- [ ] Filtros avanzados de Historial y Gastos si legacy los exige.
- [ ] Clientes: paginación/ordenación y ciclo de vida (borrado/fusión/etc.) si el contrato lo permite.
- [ ] Acciones post-guardado avanzadas en Facturar.
- [ ] Ajustes visuales finos y color cuando la paridad funcional esté más cerrada.

---

## Auditoría completa: features legacy no cubiertas en React

> Resultado de comparar `server.mjs` (rutas API) y `public/app.js` (UI) contra el código React actual.
> Clasificación: **P1** = importante, backend disponible hoy. **P2** = nice-to-have o requiere más investigación.

### Facturar — pendiente

- [ ] **(P1) Archivar factura desde Facturar/Historial:** `POST /api/documents/archive` — legacy tiene botón "Archivar" en el formulario post-guardado y en cada fila de Historial. En React solo existe archivar gasto.
- [ ] **(P1) Archivar año de facturas:** `POST /api/documents/archive-year` — equivalente al de gastos pero para documentos. No implementado en React.
- [ ] **(P1) Propagar diseño de plantilla a histórico:** `POST /api/template-profiles/propagate` — botón "Guardar diseño y actualizar facturas anteriores" en legacy. React guarda el perfil pero no dispara la propagación a documentos existentes.
- [ ] **(P2) Comprobar disponibilidad de número:** `GET /api/document-number-availability` — legacy valida en tiempo real si el número de factura ya existe antes de guardar. React usa `next-number` pero no hace esta comprobación.

### Historial — pendiente

- [ ] **(P1) Archivar documento desde Historial:** botón "Archivar" por fila en el listado. Conectado a `POST /api/documents/archive`. No existe en React.

### Gastos — pendiente

- [ ] **(P1) Campo `nextcloudUrl` en gasto:** legacy muestra/edita un enlace a carpeta Nextcloud por gasto y lo lista en la tabla de control. No visible en el formulario React.
- [ ] **(P2) Importar gastos desde libro de control:** `POST /api/control-expenses-import` — legacy permite subir un Excel de control para importar gastos en bloque. No implementado en React.

### Integraciones Gmail — sección nueva

- [ ] **(P1) Enviar factura por Gmail desde Facturar:** botón "Guardar y enviar por Gmail" (visible solo si `gmailOAuthConfigured`). Usa `POST /api/gmail/send-invoice`. No existe en React.
- [ ] **(P1) Enviar factura por Gmail desde Historial:** botón por fila y envío masivo desde el listado de control. No existe en React.
- [ ] **(P2) Configurar Gmail OAuth en Configuración:** `GET /api/gmail/status`, `GET /api/gmail/profiles`, `GET /api/gmail/oauth/start` — sección en legacy para conectar cuenta Gmail por perfil. No existe en React.

### Integraciones Nextcloud — sección nueva

- [ ] **(P2) Ir a carpeta Nextcloud desde Facturar:** chip "Ir a la carpeta de Nextcloud" visible post-guardado si `nextcloudWebBaseUrl` configurado (`GET /api/nextcloud-folder`). No existe en React.

### Importación histórica — sección nueva (completamente ausente)

- [ ] **(P2) Importación histórica de documentos:** flujo completo con `POST /api/historical-import/scan`, `/upload`, `/pdf-upload`, `/run`, `/pdf-run`. Modal de revisión con selección de perfil y año. No existe en React.

### Configuración / Diseño — pendiente

- [ ] **(P2) Editor de diseño de plantilla (constructor):** legacy tiene un editor de diseño avanzado con canvas de widgets y previsualización en tiempo real. React solo edita `layout`, `colorKey` y datos básicos del perfil.
- [ ] **(P2) Catálogo de fuentes:** `GET /api/fonts/catalog` — selector de fuentes personalizadas por perfil. No implementado en React.
- [ ] **(P2) Logo / imagen de marca:** legacy permite subir una imagen como logo del emisor (base64 embebida). React tiene campo de texto pero no input de archivo.

### Tab "Datos" — sección entera ausente en React (P1)

El legacy tiene una pestaña **"Datos"** (`tab-panel-control`) con cuatro sub-secciones distintas que no existen en React:

- [ ] **(P1) Dashboard financiero:** grid de estadísticas (`control-workbook-summary`, `control-executive-summary`, `control-quarter-strip`) — totales de facturas y gastos por perfil/año/trimestre.
- [ ] **(P1) Tabla unificada facturas + gastos** con filtros combinados (perfil, año, trimestre, estado) persistidos; chips de trimestre en móvil; filas con acciones por fila (archivar, Gmail, PDF). En React existen páginas separadas (Historial, Gastos) pero no esta vista combinada con stats.
- [ ] **(P1) Sub-panel "Importar gastos" (Excel o PDF):** `POST /api/control-expenses-import` con input de archivo múltiple, botón "Importar gastos", estado inline y lista de omitidas. No existe en React.
- [ ] **(P1) Sub-panel "Celia: Excel y columnas":** formulario de configuración de columnas por gasto (concept, taxIdType, taxCountryCode, taxId, subtotal, taxRate) + selector año/perfil + botón "Generar Excel Celia" (`POST /api/accounting/export`). En React el botón de exportar está en Gastos pero sin esta UI de columnas configurables.
- [ ] **(P1) Sub-panel "Importación histórica":** carga de PDF/Excel, selección de persona/año/perfil, previsualización de facturas detectadas, botón "Revisar antes de importar" y modal de confirmación. No existe en React.
- [ ] **(P1) Gmail bulk send desde tabla de facturas:** checkbox por fila + botón "Enviar por Gmail" masivo. No existe en React.
- [ ] **(P1) Botón "Vista compartida / Asesor"** (`POST /api/share-reports`) visible en esta sección — en React está en Historial pero no en la vista de Datos.

### Gastos — botones inline al catálogo (P1)

- [x] **(P1) Botones "Gestionar" inline en Proveedor y Categoría:** diálogo nativo con lista editable (añadir/eliminar) + drag-to-reorder, solo admin.
- [ ] **(P1) Catálogo de conceptos visible:** chips `#expense-concept-catalog-list` que muestran las categorías disponibles encima del formulario de gasto, con acceso a "Gestionar conceptos".
- [ ] **(P1) Drag-to-reorder en modal de opciones de gastos:** el modal `expense-options-modal` permite arrastrar filas para reordenar proveedores y categorías. La sección en React (`ExpenseOptionsSection`) no tiene drag-and-drop.
- [ ] **(P1) `merge-expense-into-catalog`:** botón para añadir el proveedor/concepto actual al catálogo. No existe en React.

### Configuración / Emisor — pendiente

- [x] **(P1) Logo upload (imagen de marca):** FileReader a base64, input de archivo SVG/PNG/WebP/JPEG, botón "Quitar logo", resumen del valor actual, input de ruta manual como fallback.
- [ ] **(P1) Panel de resumen de perfil activo:** `#personal-active-summary-root` y `#personal-template-summary-root` — muestra estadísticas del perfil activo y su plantilla. No existe en React.
- [ ] **(P1) Sugerencias de tag de número de factura:** panel `#invoice-tag-suggestions-panel` con chips de sugerencias cuando hay conflicto de prefijo. No existe en React.

### Configuración / Diseño (Plantilla) — sección parcialmente ausente

- [ ] **(P2) Editor de diseño avanzado completo:** la pestaña "Plantilla" tiene selectores de color hex (`design-accent-hex`, `design-dark-hex`), sliders de tamaño de fuente/columna (pt, mm) y selectores de alineación por zona (issuer, client, side, items). React solo gestiona `layout`, `colorKey` y datos básicos.
- [ ] **(P2) "Nueva base de diseño" modal:** modal `new-design-template-modal` para crear una base de diseño desde cero con selector de tipo. No existe en React.
- [ ] **(P2) Guardar diseño + propagar a histórico:** botón "Guardar diseño y actualizar facturas anteriores" (`POST /api/template-profiles/propagate`). No existe en React.

### Facturar — extras no inventariados antes

- [x] **(P2) "Repetir última factura":** snapshot post-guardado en memoria; botón visible tras el primer guardado exitoso; rellena con datos del último doc guardado, fecha hoy, sin número ni recordId.
- [ ] **(P2) Preview swatch de perfil:** franja de color del perfil activo encima del preview del PDF (`invoice-preview-profile-swatch` + `invoice-preview-profile-line`). En React el preview no muestra este indicador de perfil.

### Transversal — pendiente

- [ ] **(P1) Modo oscuro / night mode:** legacy tiene toggle de tema claro/oscuro persistido en `localStorage`. No existe en React.
- [ ] **(P2) Modo sandbox:** switch de ámbito de almacenamiento (producción vs. sandbox) persistido en `localStorage`. No existe en React.
- [ ] **(P2) Página pública de informe compartido:** `GET /api/public-share-report/:id` — legacy genera una URL de solo lectura; React genera la URL pero no tiene página para renderizarla.
- [ ] **(P2) First-use wizard:** modal `first-use-wizard-modal` con guía de orden sugerido la primera vez (emisor → plantilla → facturar). No existe en React.

---

## Regla operativa

Cada vez que se cierre un bloque de verdad:

1. se implementa
2. se valida
3. se integra en la rama correspondiente
4. se actualiza este roadmap

Si algo está hecho técnicamente pero sigue pendiente de checklist manual contra legacy, se queda como `(parcial)` y no se tacha como cerrado completo.
