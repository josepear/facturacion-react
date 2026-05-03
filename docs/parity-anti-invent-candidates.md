# Auditoría anti-inventos: candidatos «solo React» vs legacy

**Método:** `npm run inventory:legacy` (mapea `data-tab-panel` en `public/index.html`) + búsqueda en `public/app.js` y `public/index.html`.  
**Criterio:** *C* = candidato a quitar o alinear con prod (no existe en legacy y no aporta al usuario final). *B* = decisión producto / paridad pendiente (no borrar sin checklist). *A* = ya hay equivalente legacy.

Fecha: 2026-05-03

| # | React (dónde) | Legacy (`app.js` / `index.html`) | Clasificación | Notas |
|---|----------------|-----------------------------------|----------------|-------|
| 1 | `ReactQueryDevtools` en `src/app/providers.tsx` | No hay inspector flotante de queries. | **C** | Solo útil en desarrollo; en prod no debe aparecer. **Cerrado:** render condicional `import.meta.env.DEV`. |
| 2 | CRUD **miembros del sistema** vía `GET/POST /api/users` en Configuración | No aparece `/api/users` en `app.js`. Los «usuarios emisor» son `templateProfiles` en pestaña Personal (`#personal-billing-template-profile-select`, etc.). | **B** | Capacidad nueva o desplazada desde otro flujo; no eliminar sin decisión explícita y contrato backend. |
| 3 | `NotFoundPage` + ruta `*` en `router.tsx` | SPA legacy monolítica; no hay página 404 equivalente. | **A técnico** | Necesario para React Router con `basename`; no es «invento» de producto. |
| 4 | Wizard primera visita: clave `facturacion-wizard-seen` (`AppShell.tsx`) | `#first-use-wizard-modal` + clave `facturacion-first-use-wizard-dismissed` (`app.js` ~441–443). | **B** | Misma intención, **claves distintas**; alinear si se quiere coherencia con legacy en el mismo navegador. No es eliminación. |
| 5 | Importación histórica en **Datos** (`DataHistoricalImportPanel`) | Bloque extenso en pestaña Control / Datos: `#historical-import-files`, modales, clases `.historical-import-*` (`index.html` ~1631+). | **A** | Paridad de producto; no quitar. |
| 6 | Gmail en lote / fila en **Historial** | `control-invoice-bulk-gmail`, `data-gmail-send-record`, `window.open` OAuth (`app.js`). | **A** | Paridad; no quitar. |
| 7 | Helper **oauthPopup** (`src/infrastructure/gmail/oauthPopup.ts`) | Misma idea: `window.open(authUrl, "facturacion_gmail_oauth", …)` (`app.js` ~15724). | **A** | Refactor; no quitar. |
| 8 | `ProfileBadge` y microcopy extra en listas | Legacy usa chips y estilos distintos; funcionalidad de perfil sí existe. | **B** | Pulido UI; no eliminar en auditoría anti-inventos salvo checklist visual. |
| 9 | `useBlocker` + `beforeunload` en **Facturar** | Legacy: `#unsaved-changes-modal`, `hasUnsavedDocumentChanges`, comentario explícito a `beforeunload` (`app.js`). | **A** | Paridad de intención; no quitar. |
| 10 | Página **/datos** (tarjetas, tablas, export Celia, enlace compartido) | Pestaña principal «Datos» + subnav Control, Celia, `open-share-report-workbench`, `export-advisor` (`index.html` ~1524+). | **A** | Subconjunto del legacy; no quitar. |

## Orden sugerido de trabajo (seguro → arriesgado)

1. **Hecho:** Devtools solo en `DEV` (sin impacto en E2E ni usuarios prod).
2. **Bajo riesgo siguiente:** Revisar claves localStorage del wizard (4) — solo lectura/escritura alineada; probar en navegador.
3. **Medio:** Documentar en roadmap la matriz **/api/users** vs emisores legacy (2) antes de tocar UI.
4. **No tocar sin checklist prod:** ítems **A** de producto (historial, datos, Gmail, unsaved).

## Comandos de inventario

```bash
cd facturacion-react
npm run inventory:legacy | head -c 4000
npm run inventory:legacy:md > /tmp/legacy-inventory.md
```
