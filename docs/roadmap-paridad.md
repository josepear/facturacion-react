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

### Parcial

- [ ] (parcial) Coherencia exacta con Facturar si legacy usa otro criterio adicional de matching (p. ej., prioridad por NIF o reglas de desempate).

### Pendiente

- [ ] Paginación, ordenación y filtros en servidor o más ricos si legacy los tiene.
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
- [ ] Reporting/export si existe en legacy.

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

## Regla operativa

Cada vez que se cierre un bloque de verdad:

1. se implementa
2. se valida
3. se integra en la rama correspondiente
4. se actualiza este roadmap

Si algo está hecho técnicamente pero sigue pendiente de checklist manual contra legacy, se queda como `(parcial)` y no se tacha como cerrado completo.
