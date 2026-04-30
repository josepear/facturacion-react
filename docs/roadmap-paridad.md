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
- [ ] Checklist manual sistemático contra legacy en producción para cerrar filas marcadas como parciales.

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
- [ ] (parcial) `taxRate`: confirmar topes/catálogo.
- [ ] (parcial) Preview local frente a HTML oficial/pixel-perfect.
- [ ] (parcial) PDF oficial: confirmar disponibilidad estable en todos los entornos.
- [ ] (parcial) Histórico de Facturar: límite de 40 recientes frente a legacy.

### Pendiente

- [ ] Acciones post-guardado del legacy si existen (enviar, duplicar, anular, etc.).
- [ ] `lineTotal` manual por línea si el legacy lo soporta.
- [ ] Cualquier tipo de documento adicional si el legacy usa más que factura/presupuesto.

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

### Parcial

- [ ] (parcial) Filtros por tipo + año + texto están bien, pero faltan dimensiones más ricas si legacy las tiene (estado, perfil, rangos de fecha).

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

### Parcial

- [ ] (parcial) Coherencia exacta con Facturar si legacy usa otro criterio de matching/normalización.

### Pendiente

- [ ] Paginación, ordenación y filtros en servidor o más ricos si legacy los tiene.
- [ ] Ciclo de vida ausente: borrar, fusionar, archivar duplicados o equivalentes si existen en legacy.

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

### Parcial

- [ ] (parcial) `vendor`: confirmar obligatoriedad real frente a legacy/backend.
- [ ] (parcial) `category`: confirmar si debe ser lista cerrada.
- [ ] (parcial) `invoiceNumberEnd`: confirmar formato/regla legacy.
- [ ] (parcial) `issueDate`: confirmar obligatoriedad exacta.
- [ ] (parcial) `operationDate`: visible, pero pendiente checklist de obligatoriedad/regla.
- [ ] (parcial) `expenseConcept`: visible, pendiente contraste semántico con `description`.
- [ ] (parcial) `paymentMethod`: visible, pendiente confirmar catálogo estricto.
- [ ] (parcial) `taxRate` / `taxAmount`: pendiente confirmar si legacy permite importe manual.
- [ ] (parcial) `withholdingRate` / `withholdingAmount`: pendiente confirmar catálogo/regla.
- [ ] (parcial) `total`: confirmar si legacy permite edición manual.
- [ ] (parcial) `templateProfileId`: checklist legacy frente a comportamiento exacto al guardar con perfil vacío vs explícito (React ya documenta y alinea con `activeTemplateProfileId`).
- [ ] (parcial) Filtros adicionales si legacy los exige.
- [ ] (parcial) Permisos de archivar vs política legacy.
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
