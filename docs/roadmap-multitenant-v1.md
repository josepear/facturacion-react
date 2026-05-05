# Roadmap Multitenant v1

Fecha: 2026-05-05

## Objetivo

Ejecutar una migracion incremental a multitenant robusto sin romper flujos actuales de facturacion, permisos y OAuth.

## Fase 1 — Baseline

- Congelar estado funcional actual (auth, permisos por emisor, OAuth Google, facturacion principal).
- Catalogar invariantes no negociables (rutas publicas, contratos API, comportamiento login/logout).
- Definir matriz de riesgo inicial por modulo y entorno (local/runtime).

## Fase 2 — Auth y Sesion

- Alinear sesion interna con `tenantId` como dato obligatorio y consistente.
- Asegurar que login/password y OAuth producen contexto de sesion equivalente por tenant.
- Endurecer expiracion/revocacion de sesion sin fugas cross-tenant.

## Fase 3 — Aislamiento de Datos

- Aplicar filtros tenant-first en lecturas y mutaciones de documentos, gastos, clientes e historial.
- Validar acceso por `recordId/path` contra recurso real y tenant efectivo.
- Cubrir con tests de regresion para evitar lecturas/escrituras entre tenants.

## Fase 4 — Emisores

- Normalizar `templateProfiles` por tenant y reglas de seleccion de emisor activo.
- Evitar colisiones de datos compartidos (etiquetas de numeracion y defaults).
- Garantizar UX consistente para administracion/edicion de emisores en UI React.

## Fase 5 — Hardening

- Revisar y cerrar superficies de bypass de permisos en endpoints sensibles.
- Estandarizar codigos de error esperables (400/401/403/404/409) y mensajes operativos.
- Consolidar validaciones server-side para payloads y estados intermedios.

## Fase 6 — Observabilidad

- Instrumentar logs estructurados por tenant, usuario, endpoint y resultado.
- Incorporar trazas minimas para diagnostico de authz/session sin exponer secretos.
- Definir checklist de verificacion operativa post-deploy.

## Fase 7 — OAuth Extra

- Extender modelo Google actual a Microsoft y Apple con el mismo contrato interno.
- Mantener politica de mapeo a usuario interno existente (sin auto-alta por defecto).
- Reutilizar controles de state/TTL/anti-replay y tratamiento uniforme de errores.

## Fase 8 — Cierre

- Ejecutar smoke final multitenant (admin/editor, tenants cruzados, OAuth y logout/relogin).
- Publicar documento final de estado + riesgos residuales + plan de rollback.
- Cerrar con evidencia reproducible (tests, build, checks manuales y estado de ramas).
