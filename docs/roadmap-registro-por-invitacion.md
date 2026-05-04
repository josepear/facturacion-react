# Roadmap: registro por invitación (estilo SaaS)

**Estado:** planificado para ejecución **posterior**; no forma parte del cierre de paridad Legacy → React documentado en [`roadmap-paridad.md`](./roadmap-paridad.md).

**Decisión de producto:** el alta de cuentas nuevas será **solo por invitación** (no registro público abierto). Inspiración de UX: flujos tipo Cursor u otras apps donde el usuario recibe un enlace o código, crea acceso y queda bajo gestión del espacio de trabajo.

---

## 1. Objetivos

1. Un **administrador** (o rol equivalente) puede **invitar** a una dirección de correo (y opcionalmente preasignar rol y emisores permitidos).
2. El invitado **acepta la invitación** en una pantalla dedicada (React), define credencial o enlaza **proveedor OAuth** cuando exista.
3. Tras aceptar, el usuario **aparece en la gestión de miembros** con el mismo modelo de permisos que hoy (`admin` / `editor` / `viewer`, `allowedTemplateProfileIds`, etc.).
4. Las invitaciones **caducan** y se pueden **revocar** antes de uso.

---

## 2. Alcance fuera de este documento (por ahora)

- Paridad campo a campo con el HTML legacy de login.
- Sustituir de golpe el flujo actual de `POST /login` + sesión en disco sin plan de migración.
- Registro abierto sin invitación o self-service de nuevos tenants multi-empresa (salvo que más adelante se defina explícitamente).

---

## 3. Situación de partida (repo actual)

- Autenticación **sesión + token** en el servidor Node (`authController`, `.facturacion-sessions.json`); login React en `/react/`.
- Miembros persistidos en **`users[]`** de `facturacion.config.json` (y/o rutas `GET/POST /api/users` cuando existan en el despliegue).
- **Gmail OAuth** ya es un precedente de OAuth **por emisor**; el registro por invitación es OAuth/identidad **por usuario de aplicación** (concepto distinto, puede convivir).

Este roadmap asume que la **fuente de verdad de miembros** seguirá siendo el servidor de facturación (o una capa explícitamente definida), no solo el cliente.

---

## 4. Fases sugeridas (orden lógico)

### Fase 0 — Decisiones y límites (sin código o mínimo spike)

- [ ] Confirmar **caducidad** típica del enlace (p. ej. 7 / 14 días) y si se permite **reenviar** invitación.
- [ ] Definir si la invitación fija **rol y emisores** o solo el email y el admin ajusta después.
- [ ] Elegir estrategia de identidad:
  - **A)** Solo email + enlace mágico o contraseña inicial (menos dependencias).
  - **B)** Proveedor gestionado (Clerk, Auth0, WorkOS, Supabase Auth…) que devuelve JWT y mapeáis a `users[]`.
  - **C)** OAuth directo Google (y más tarde Apple / Microsoft) contra vuestro backend.
- [ ] Política de **dominio** (solo emails de empresa, lista blanca, etc.).

### Fase 1 — Modelo de datos y persistencia de invitaciones

- [ ] Tabla o fichero versionado en servidor: `token` (hash), `email`, `invitedBy`, `role`, `allowedTemplateProfileIds`, `createdAt`, `expiresAt`, `consumedAt`, `revokedAt`.
- [ ] Job o comprobación en **aceptar invitación**: rechazar si caducada o revocada.

### Fase 2 — API servidor

- [ ] `POST /api/invitations` (admin): crear invitación; envío de email (o devolver enlace para copiar en MVP interno).
- [ ] `GET /api/invitations/validate?token=…` (público o semipúblico): devuelve si el token es válido y metadatos no sensibles (email enmascarado, caducidad).
- [ ] `POST /api/invitations/accept`: body con token + contraseña **o** código de intercambio OAuth; crea usuario en `users[]` (o equivalente) y marca invitación consumida.
- [ ] `POST /api/invitations/revoke` (admin).
- [ ] Auditoría mínima (quién invitó, cuándo se aceptó).

### Fase 3 — React

- [ ] Ruta pública o semipública: **`/react/invitacion`** (o query `?token=`) con flujo guiado: validar token → establecer acceso → redirigir a login o sesión ya creada según diseño.
- [ ] En **Emisores / Miembros** (admin): UI «Invitar», listado de invitaciones pendientes, reenviar, revocar.
- [ ] Textos legales mínimos (privacidad del correo invitado) si aplica.

### Fase 4 — OAuth (opcional, incremental)

- [ ] **Google** primero (menor fricción operativa que Apple).
- [ ] **Microsoft** (Entra / cuentas personales según decisión).
- [ ] **Apple** (más pasos en consola y verificación de dominio).

Cada proveedor: client id/secret en runtime, redirect URI al mini o entorno de prueba, asociación estable `issuer` + `sub` → `user.id` interno.

### Fase 5 — Endurecimiento

- [ ] Límite de invitaciones por hora / anti-abuso.
- [ ] Notificación al admin cuando alguien acepta.
- [ ] Pruebas E2E del flujo feliz invitar → aceptar → login.

---

## 5. Criterios de “hecho” para la primera versión usable (MVP)

- Admin puede invitar por email y el invitado puede **activar cuenta** sin tocar `facturacion.config.json` a mano.
- Sin registro público: intento de acceso sin token válido → mensaje claro.
- Revocación y caducidad comprobadas en tests o checklist manual documentado.

---

## 6. Riesgos y cumplimiento

- **RGPD:** base jurídica del envío del email de invitación, retención de logs, derecho de supresión del usuario invitado que no llegó a aceptar.
- **Seguridad:** tokens opacos con hash en servidor; nunca reutilizar el mismo token tras consumo.
- **Operación:** plantillas de correo (SPF/DKIM) si el envío lo hace el propio Node.

---

## 7. Seguimiento

Cuando se arranque el trabajo:

1. Crear rama dedicada (p. ej. `feat/invitaciones-registro`).
2. Actualizar este documento tachando fases y enlazando PRs o commits.
3. Mantener [`roadmap-paridad.md`](./roadmap-paridad.md) solo para paridad legacy/React; este archivo es el tablero del **producto auth / invitaciones**.

---

## Referencias internas actuales

- Login React: `src/features/auth/LoginPage.tsx`, `RequireAuth`, `httpClient` (Bearer).
- Miembros: `src/infrastructure/api/usersApi.ts`, `SettingsPage` (sección miembros, admin).
- Despliegue y sesiones: [`.cursor/rules/facturacion-deployment.mdc`](../.cursor/rules/facturacion-deployment.mdc), reglas de invariantes del servidor en el monorepo padre.
