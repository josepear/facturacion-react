# Roadmap CMS Interno v1

Fecha: 2026-05-05

## Objetivo V1

Permitir editar contenidos de la UI sin tocar codigo, con control admin y sin romper logica de negocio.

## Alcance funcional (V1)

- Editar titulos de pantalla.
- Editar descripciones y ayudas.
- Editar textos de botones secundarios.
- Editar mensajes informativos no criticos.
- No editar reglas de negocio, validaciones ni permisos.

## Modelo de datos

- Un JSON de contenidos por modulo:
  - `facturar`
  - `gastos`
  - `clientes`
  - `historial`
  - `configuracion`
- Estructura simple `clave -> texto`.
- Idioma base: `es`.

## API minima (backend)

- `GET /api/content`: leer contenido publicado.
- `POST /api/content`: guardar borrador (solo admin).
- `POST /api/content/publish`: publicar borrador (solo admin).
- `POST /api/content/restore`: restaurar version anterior (solo admin).

## Frontend minimo

- Hook `useContent(key, fallback)` para resolver texto de UI con fallback seguro.
- Sustitucion progresiva de hardcodes por claves de contenido.
- Pantalla admin "Gestor de contenido":
  - buscar clave
  - editar valor
  - guardar borrador
  - publicar
  - restaurar version

## Permisos

- Admin: editar, publicar y restaurar.
- Editor: solo lectura.
- Scope tenant: contenido aislado por tenant (si aplica en runtime).

## Seguridad

- Sanitizar entradas de texto.
- Limitar longitud por campo.
- Registrar auditoria minima (quien, que, cuando).

## Plan de entrega

### Fase A — Infraestructura

- Endpoints base + almacenamiento versionado.
- Guardas por rol admin/editor.
- Pruebas de contrato API.

### Fase B — Piloto Facturar

- Integrar `useContent` en Facturar (titulos/ayudas/mensajes no criticos).
- Pantalla Gestor de contenido funcional para modulo Facturar.

### Fase C — Extension

- Extender a Gastos, Clientes, Historial y Configuracion.
- Añadir historial de versiones y rollback en 1 click.

## Riesgos controlados

- Mantener fallback al texto actual si falta clave.
- Evitar cambios en reglas de negocio desde CMS.
- Rollback rapido ante contenido defectuoso.

## Criterio de exito V1

- Admin cambia un texto de Facturar y se refleja en runtime tras publicar.
- Editor no puede editar contenido.
- Se puede restaurar una version anterior en un paso.
