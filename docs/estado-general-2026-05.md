# Estado general de implementacion (mayo 2026) - Frontend (React)

Documento maestro del repo **facturacion-react** (SPA Vite, Router, TanStack Query). Complemento del informe equivalente en el repo servidor **facturacion**. Pensado para producto y operaciones; el detalle de codigo sigue en docs de paridad y roadmaps enlazados.

---

## 0. Matriz de permisos y regresiones

- **Matriz viva (fuente de verdad)** vive en el repo servidor: `facturacion/docs/matriz-permisos-multitenant-v1.md` (en monorepo: `../docs/matriz-permisos-multitenant-v1.md` desde la raíz del padre).
- **Cobertura UI**: el mapa en esa matriz enlaza `SettingsPage.test.tsx` (Miembros / emisores), `DataPage.test.tsx` (legacy sin emisor), `AsesorScopePages.test.tsx`, `useFacturarForm.test.tsx`, `HistoryPage.test.tsx` (archivo/papelera admin); ampliar el mapa allí si se añaden pantallas.
- **Smoke post-deploy (~5 min)**: mismo checklist que backend en `facturacion/docs/estado-general-2026-05.md` sección *Smoke post-deploy (5 min)*, más: login en `/react/`, Historial sin botones de archivar activos para editor, Configuración sin bloque “Miembros” para editor.

---

## 1. Resumen ejecutivo

- SPA servida en produccion bajo `/react/` por el servidor Node del monorepo padre (assets publicos sin Bearer).
- Login por email/contrasena estable; flujo "Entrar con Google" con popup, intercambio de sesion y mismo token interno que password.
- Multitenant V1 en UI: `sessionScope` centralizado (emisores visibles, admin vs editor) aplicado a facturacion, historial, gastos, clientes, datos y asesor.
- Registros sin `templateProfileId` (legacy): ocultos o no operables para editor segun modulo; admin mantiene visibilidad donde se definio.
- Configuracion: gestion de emisores en modales; panel de miembros oculto para rol editor; tests de regresion en paginas tocadas.
- Clientes: editor puede crear/editar/archivar dentro de su alcance de emisor; bloqueos claros fuera de scope.
- UI movil y tablet: overflow, safe-area, tactil minimo y modales revisados en flujos principales (convenciones en reglas del repo `.cursor/rules`).
- Documentacion de migracion de `facturacion.config.json`, E2E runbook y roadmaps de paridad y multitenant actualizados a lo largo del ciclo.
- Builds verificados con `npm run test` y `npm run build` en hitos clave; E2E opcional contra API real documentado.
- Proximos hitos: V1.1 (hardening + movil residual), V2 (invitaciones, OAuth extra) alineados con roadmaps enlazados abajo.

---

## 2. Que quedo cerrado

| Area | Estado |
| --- | --- |
| Auth en cliente | Token en almacenamiento local, rutas protegidas, logout, re-login Google estable (`0998828` y relacionados). |
| OAuth Google | Popup + exchange; mensajes de error 401/403/409 mapeados en pantalla de login. |
| Permisos por emisor en UI | `resolveSessionScope` / `isTemplateProfileInScope` en modulos operativos. |
| Clientes | Operaciones editor en scope; listados filtrados (`0e77751`). |
| Multitenant V1 (React) | Merge dedicado; hidratacion bloqueada fuera de scope en facturas/historial/gastos (`2db93e6`, `3d2911a`, `d1031df`, `ec40bee`). |
| Datos + Asesor | Listados, filtros, export y resumen compartible respetan alcance; tests de pagina (`1c7f18c`). |
| Ajustes UI | Facturar, shell, settings, previews compartidos (commits de UI en abril-mayo 2026 segun historial). |

---

## 3. Que cambio por modulos (tabla)

| Modulo | Cambio (alto nivel) | Repo | Commit / referencia |
| --- | --- | --- | --- |
| Auth / Google | Popup OAuth + UX login | facturacion-react | `2fb8c0d`, `179b1f0`, `0998828` |
| Multitenant app | Scope tenant/emisor en rutas | facturacion-react | `2db93e6`, `ec40bee` |
| Facturar / historial / gastos | Bloqueo hidratacion fuera de scope | facturacion-react | `3d2911a`, `d1031df` |
| Clientes | Editor operativo en alcance | facturacion-react | `0e77751` |
| Settings | Miembros ocultos para editor + tests | facturacion-react | `c7fd481`, `ffcebaa` |
| Datos + Asesor | Scope + dialogo resumen + Celia/Libro | facturacion-react | `1c7f18c` |
| Roadmap interno | CMS v1 plan (doc) | facturacion-react | `071288b` |
| Servidor (complemento) | OAuth, sesion, authz, tests | facturacion | `2c4c883`, `c51329b`, `c495915`, etc. |

Enlaces GitHub a commits representativos:

- `https://github.com/josepear/facturacion-react/commit/1c7f18c`
- `https://github.com/josepear/facturacion-react/commit/ec40bee`
- `https://github.com/josepear/facturacion/commit/c495915`

Merge conocido en historial: **PR #16** (`794bcc5` "Merge pull request #16 from josepear/ordenar_todo_react").

---

## 4. Politica final de permisos (admin / editor)

- **Administrador**: ve todos los emisores del tenant en selectores; acciones de mantenimiento (usuarios, papelera global donde exista en UI) reservadas a admin.
- **Editor**: selectores y listados acotados a `allowedTemplateProfileIds`; botones de guardado/export deshabilitados o servidor responde 403 si se fuerza el identificador.
- **Sin emisor en registro legacy**: en listados de producto el editor no debe depender de filas sin `templateProfileId`; el admin puede verlas donde el modulo lo define (Datos, etc.).

---

## 5. Decisiones de producto importantes

- **Un solo token de sesion** tras password u OAuth simplifica interceptores HTTP y logout.
- **Scope en cliente + refuerzo en servidor**: la UI evita errores; el backend garantiza seguridad aunque alguien manipule la API.
- **Emisores en modales en Configuracion**: reduce scroll infinito y mejora uso en movil frente al formulario inline previo.
- **Paridad incremental** con legacy: se prioriza no romper contratos `/api/*` mientras se migra pantalla a pantalla.

---

## 6. Problemas encontrados y como se resolvieron

| Problema | Resolucion |
| --- | --- |
| Usuario Google tras logout quedaba en estado inconsistente | Hard reset de flujo OAuth documentado y commit `0998828`. |
| Editor guardaba fuera de emisor por hidratacion | Bloqueo de `recordId` y alineacion de payload con scope (`d1031df`, `3d2911a`). |
| Tablas y modales cortados en movil | Ajustes de `min-w-0`, overflow, safe-area y altura tactil en componentes compartidos. |
| Desalineacion proxy Vite / preview | Documentado en README: proxy a `/api` y `/login`; runbook E2E para diagnostico. |

---

## 7. Estado actual de produccion / runtime

- La SPA que ve el usuario en `https://facturacion.pearandco.es/react/` corresponde al ultimo **build desplegado** (`npm run build` en CI local + `deploy-to-macmini.sh` desde el repo padre).
- Para validar revision: comprobar fecha/hash de `index-*.js` en red o proceso de deploy documentado en `facturacion/docs/macmini-operativa-publica.md`.
- Desarrollo local: `npm run dev` con proxy hacia API (ver README de este repo).

---

## 8. Riesgos pendientes (max 10)

1. Submodulo o checkout del front desalineado con `origin/main` en el mini.
2. Cache de navegador en assets con hash (usuarios con bundle antiguo).
3. E2E dependiente de API externa estable (`E2E_API_TARGET`).
4. Pendientes moviles listados en `docs/roadmap-multitenant-v1.md` (menu, zoom iOS, etc.).
5. Duplicidad de documentacion si no se actualiza este maestro tras nuevos hitos.
6. Editor con `allowedTemplateProfileIds` vacio interpretacion "todos" vs "ninguno" (validar siempre contra `/api/session`).
7. Modulos aun en paridad parcial con legacy (seguir `roadmap-paridad.md`).
8. OAuth sin onboarding para emails no autorizados (403 esperado; UX de soporte).
9. Playwright local sin browsers instalados.
10. Roadmap CMS interno (`roadmap-cms-interno-v1.md`) aun no ejecutado en codigo.

---

## 9. Checklist operativo de verificacion (reproducible)

1. `npm ci` (o `npm install`) en `facturacion-react`.
2. `npm run test -- --run` -> todos los tests unitarios en verde.
3. `npm run build` -> sin errores TypeScript ni Vite.
4. `npm run dev` -> abrir `/react/login`, login password y comprobar redireccion.
5. Login con Google en entorno con OAuth configurado (popup, no error 409 repetido).
6. Rol editor de prueba: Historial y Gastos solo muestran emisores permitidos.
7. Clientes: crear borrador solo en emisor permitido; 403 en red si se fuerza API (opcional con curl).
8. Datos / Asesor: sin emisores asignados, mensaje de bloqueo visible; con emisor, export habilitada segun rol.
9. Configuracion (admin): abrir modal de emisor y guardar cambio menor.
10. Tras deploy produccion: repetir login y una lectura de `/api/session` coherente con UI.

---

## 10. Proximos pasos (roadmap corto)

- **V1.1**: cerrar pendientes moviles del roadmap multitenant; mas cobertura E2E; revisar modulos restantes de paridad.
- **V2**: registro solo por invitacion; OAuth proveedores adicionales cuando el backend los exponga.
- **Referencias**: [roadmap-multitenant-v1.md](./roadmap-multitenant-v1.md), [roadmap-paridad.md](./roadmap-paridad.md), [roadmap-registro-por-invitacion.md](./roadmap-registro-por-invitacion.md).

---

## Smoke post-deploy (5 min) — cliente

1. Abrir `/react/` tras deploy, hard reload si hace falta.
2. Login editor restringido: Historial → botones **Archivar documento** y **Archivar ejercicio** deben estar **deshabilitados**; papelera muestra aviso sin permiso de borrado.
3. Configuración → no debe aparecer **Miembros del sistema**.
4. Datos → contadores coherentes con emisores visibles (sin filas legacy huérfanas en editor).
5. Facturar → guardar bloqueado sin emisor válido (checklist de flujo).

Detalle API compartido: repo servidor `docs/estado-general-2026-05.md`.

---

## Indice de documentos relacionados (este repo)

- [Roadmap multitenant V1](./roadmap-multitenant-v1.md)
- [Roadmap paridad legacy](./roadmap-paridad.md)
- [Git workflow](./git-workflow.md)
- [Migracion config emisores y usuarios](./migracion-facturacion-config-emisores-y-usuarios.md)
- [E2E Facturar runbook](./e2e-facturar-critical-flow-runbook.md)
- [Facturar mejoras y paridad conceptos](./facturar-mejoras-y-paridad-conceptos.md)

Informe equivalente (servidor y despliegue): en el repo **facturacion**, `docs/estado-general-2026-05.md`. Matriz de permisos: `facturacion/docs/matriz-permisos-multitenant-v1.md`.
