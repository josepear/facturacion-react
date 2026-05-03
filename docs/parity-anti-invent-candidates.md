# Auditoría anti-inventos: candidatos «solo React» vs legacy

**Método:** `npm run inventory:legacy` (mapea `data-tab-panel` en `public/index.html`) + búsqueda en `public/app.js` y `public/index.html`.  
**Criterio:** *C* = candidato a quitar o alinear con prod (no existe en legacy y no aporta al usuario final). *B* = decisión producto / paridad pendiente (no borrar sin checklist). *A* = ya hay equivalente legacy.

Fecha: 2026-05-03

| # | React (dónde) | Legacy (`app.js` / `index.html`) | Clasificación | Notas |
|---|----------------|-----------------------------------|----------------|-------|
| 1 | `ReactQueryDevtools` en `src/app/providers.tsx` | No hay inspector flotante de queries. | **C** | Solo útil en desarrollo; en prod no debe aparecer. **Cerrado:** render condicional `import.meta.env.DEV`. |
| 2 | CRUD **miembros del sistema** vía `GET/POST /api/users` en Configuración | No aparece `/api/users` en `app.js`. Los «usuarios emisor» son `templateProfiles` en pestaña Personal (`#personal-billing-template-profile-select`, etc.). | **B** | Contrato HTTP en [`usersApi.ts`](../src/infrastructure/api/usersApi.ts). **Auditoría estática 2026-05-03:** en el `server.mjs` del monorepo no figura el literal `/api/users` entre las rutas `/api/...` inventariadas; los logins siguen modelándose en `facturacion.config.json` (`users[]`, ver `app/controllers/authController.mjs`). Ver sección siguiente. |
| 3 | `NotFoundPage` + ruta `*` en `router.tsx` | SPA legacy monolítica; no hay página 404 equivalente. | **A técnico** | Necesario para React Router con `basename`; no es «invento» de producto. |
| 4 | Wizard primera visita (`AppShell.tsx`, [`wizardFirstUseStorage.ts`](../src/infrastructure/wizardFirstUseStorage.ts)) | `#first-use-wizard-modal` + `facturacion-first-use-wizard-dismissed` (`app.js`, valor `"1"`). | **B → cerrado en repo** | Lectura híbrida: si cualquiera de las dos claves vale `"1"`, no se muestra el modal React. Al cerrar, se escriben **ambas** claves para no repetir wizard al pasar entre `/react/` y `/`. |
| 5 | Importación histórica en **Datos** (`DataHistoricalImportPanel`) | Bloque extenso en pestaña Control / Datos: `#historical-import-files`, modales, clases `.historical-import-*` (`index.html` ~1631+). | **A** | Paridad de producto; no quitar. |
| 6 | Gmail en lote / fila en **Historial** | `control-invoice-bulk-gmail`, `data-gmail-send-record`, `window.open` OAuth (`app.js`). | **A** | Paridad; no quitar. |
| 7 | Helper **oauthPopup** (`src/infrastructure/gmail/oauthPopup.ts`) | Misma idea: `window.open(authUrl, "facturacion_gmail_oauth", …)` (`app.js` ~15724). | **A** | Refactor; no quitar. |
| 8 | `ProfileBadge` y microcopy extra en listas | Legacy usa chips y estilos distintos; funcionalidad de perfil sí existe. | **B** | Pulido UI; no eliminar en auditoría anti-inventos salvo checklist visual. |
| 9 | `useBlocker` + `beforeunload` en **Facturar** | Legacy: `#unsaved-changes-modal`, `hasUnsavedDocumentChanges`, comentario explícito a `beforeunload` (`app.js`). | **A** | Paridad de intención; no quitar. |
| 10 | Página **/datos** (tarjetas, tablas, export Celia, enlace compartido) | Pestaña principal «Datos» + subnav Control, Celia, `open-share-report-workbench`, `export-advisor` (`index.html` ~1524+). | **A** | Subconjunto del legacy; no quitar. |

## Miembros del sistema (`/api/users`) vs legacy

- **React:** Configuración → pestaña de miembros llama a `GET /api/users`, `POST /api/users` (cuerpo `{ user }`) y `POST /api/users/delete` (cuerpo `{ id }`) según [`usersApi.ts`](../src/infrastructure/api/usersApi.ts).
- **Legacy:** no hay llamadas XHR a `/api/users` en `public/app.js`. La identidad y los permisos se resuelven desde `facturacion.config.json` (`users[]`, perfiles plantilla, etc.); la UI legacy edita emisores/perfiles en la pestaña Personal, no un CRUD REST homónimo al de React.
- **Servidor (monorepo):** conviene confirmar en el despliegue real que existan handlers para esas rutas. Una pasada por literales `"/api/..."` en `server.mjs` **de este repo** (2026-05-03) listó decenas de rutas (`/api/session`, `/api/config`, …) **sin** incluir `/api/users`; si en prod la pantalla React devolviera 404, el gap es de backend o de rama desincronizada, no de «invento» de UI sola.

## Orden sugerido de trabajo (seguro → arriesgado)

1. **Hecho:** Devtools solo en `DEV` (sin impacto en E2E ni usuarios prod).
2. **Hecho:** Claves localStorage del wizard (4) — lectura/escritura alineada con legacy; E2E fija ambas claves.
3. **Hecho en docs:** Roadmap y esta página documentan **/api/users** vs `users[]` legacy y la auditoría estática de `server.mjs`; no tocar UI hasta que el contrato HTTP esté garantizado en prod.
4. **No tocar sin checklist prod:** ítems **A** de producto (historial, datos, Gmail, unsaved).

## Comandos de inventario

```bash
cd facturacion-react
npm run inventory:legacy | head -c 4000
npm run inventory:legacy:md > /tmp/legacy-inventory.md
```
