# Documentación — índice único

Punto de entrada a toda la documentación de la app de facturación. Si buscas **una sola verdad
por capa** (qué código vive dónde, qué se despliega y cómo), empieza por
[`despliegue-y-fuente-unica.md`](despliegue-y-fuente-unica.md).

Regla de mantenimiento: **todo documento nuevo se enlaza aquí** (y, si es relevante para el día a
día, también en el `README.md` raíz). Un doc que no está en este índice se considera huérfano.

## 1. Arquitectura, fuente única y operación

| Documento | Qué contiene |
| --- | --- |
| [`despliegue-y-fuente-unica.md`](despliegue-y-fuente-unica.md) | Dónde vive cada capa (SPA, backend, runtime), qué es la única verdad, cómo se compila y publica la SPA y reglas anti-deriva. **Empieza aquí.** |
| [`phase-0-guardrails.md`](phase-0-guardrails.md) | Guardrails de arquitectura de la Fase 0 (límites entre capas). |
| [`phase-0-reuse-map.md`](phase-0-reuse-map.md) | Mapa de reutilización de la Fase 0 (qué se reutiliza del legacy). |
| [`git-workflow.md`](git-workflow.md) | Ramas, convención de commits y flujo de trabajo del repo React. |
| [`estado-general-2026-05.md`](estado-general-2026-05.md) | Estado de implementación del frontend (auth, OAuth Google, permisos por emisor, multitenant V1, UI móvil). |

## 2. Funcionalidad de la app

| Documento | Qué contiene |
| --- | --- |
| [`facturar-nombre-proyecto.md`](facturar-nombre-proyecto.md) | Campo «Nombre del proyecto»: modelo, Zod, mappers, persistencia e impresión en las 3 plantillas legacy. |
| [`facturar-modos-calculo-conceptos.md`](facturar-modos-calculo-conceptos.md) | «Por concepto» vs «Por bruto (importe manual)»: IGIC/IRPF sobre el bruto, checklist y tests. |
| [`facturar-mejoras-y-paridad-conceptos.md`](facturar-mejoras-y-paridad-conceptos.md) | Mejoras recientes en conceptos, Guardar y paridad con el legacy. |
| [`registro-envios-email.md`](registro-envios-email.md) | Registro de envíos por Gmail: qué guarda el servidor (`gmailLastSend`), dónde se ve y cómo sobrevive al volver a guardar. |
| [`ui-colores-y-texto.md`](ui-colores-y-texto.md) | Colores de la app React: texto `#1e1e1e` y fondos de fila del Historial por tipo. |

## 3. Gastos e importación de extractos

| Documento | Qué contiene |
| --- | --- |
| [`import-gastos-excel-extractos-bancarios.md`](import-gastos-excel-extractos-bancarios.md) | Importador de Excel del banco: cabeceras por hoja, fecha local, trimestre, selección/descarte de filas antes de confirmar. |
| [`gastos-field-parity-matrix.md`](gastos-field-parity-matrix.md) | Matriz campo a campo Gastos: legacy vs React. |
| [`facturar-field-parity-matrix.md`](facturar-field-parity-matrix.md) | Matriz campo a campo Facturar: legacy vs React. |

## 4. Informe del asesor (enlace público)

| Documento | Qué contiene |
| --- | --- |
| [`informe-asesor-ver-factura-html.md`](informe-asesor-ver-factura-html.md) | Botón «Ver factura» en el informe, endpoint público token-scoped y render del HTML oficial. |

## 5. Calidad y verificación

| Documento | Qué contiene |
| --- | --- |
| [`e2e-facturar-critical-flow-runbook.md`](e2e-facturar-critical-flow-runbook.md) | Runbook del E2E Playwright del flujo crítico de Facturar (proxy, harness, wizard, timeouts en macOS). |
| [`parity-manual-prod-checklist.md`](parity-manual-prod-checklist.md) | Checklist manual de paridad en producción. |

## 6. Paridad y auditorías legacy → React

| Documento | Qué contiene |
| --- | --- |
| [`roadmap-paridad.md`](roadmap-paridad.md) | Roadmap de paridad Legacy → React (fases y criterios de cierre). |
| [`legacy-react-parity-audit.md`](legacy-react-parity-audit.md) | Auditoría de paridad (qué está cubierto y qué falta). |
| [`parity-partials-legacy-code-evidence.md`](parity-partials-legacy-code-evidence.md) | Evidencia en el código legacy (`public/app.js`) para los parciales. |
| [`parity-anti-invent-candidates.md`](parity-anti-invent-candidates.md) | Candidatos «solo React» sin respaldo en el legacy (riesgo de invento). |

## 7. Seguridad, permisos y multitenant

| Documento | Qué contiene |
| --- | --- |
| [`migracion-facturacion-config-emisores-y-usuarios.md`](migracion-facturacion-config-emisores-y-usuarios.md) | Migrar emisores y usuarios desde `facturacion.config.json` legacy hacia React. |
| [`roadmap-multitenant-v1.md`](roadmap-multitenant-v1.md) | Roadmap de multitenant v1 (aislamiento por usuario/emisor). |
| [`roadmap-registro-por-invitacion.md`](roadmap-registro-por-invitacion.md) | Proyecto de registro solo por invitación (estilo SaaS). |
| [`roadmap-cms-interno-v1.md`](roadmap-cms-interno-v1.md) | Roadmap del CMS interno v1. |

## 8. Documentación del backend (repo privado `josepear/facturacion`)

Estos documentos **no** viven en este repo. Ruta local:
`/Users/josemendoza/Repos/facturacion`.

- `README.md` — arquitectura, única verdad y flujo de despliegue del backend/monorepo.
- `CONVENTIONS.md` — convenciones de código y commits.
- `docs/arranque-login-y-atajos.md` — arranque, login y accesos rápidos.
- `docs/gmail-y-envio-facturas.md` — OAuth de Gmail y envío de facturas.
- `docs/macmini-operativa-publica.md` — operativa del Mac mini y publicación.
- `docs/css-cache-versionado-y-arranque.md` — cache-busting y arranque.
- `docs/matriz-permisos-multitenant-v1.md` — matriz de permisos del multitenant.
- `docs/checklist-humo.md` — checklist de humo tras despliegue.
