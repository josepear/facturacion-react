# Fuente única y despliegue (React + backend + runtime)

Objetivo: **una sola verdad por capa**. Hay dos repositorios Git (frontend y backend) y un runtime
que solo contiene configuración, secretos y artefactos. Nada de copias de trabajo sueltas.

## Capas y verdades

| Capa | Repositorio / ruta | GitHub |
|---|---|---|
| SPA React (código) | `/Users/josemendoza/Repos/facturacion-react` | `josepear/facturacion-react` (público) |
| Backend / monorepo (código) | `/Users/josemendoza/Repos/facturacion` | `josepear/facturacion` (privado) |
| Runtime (despliegue) | `/Users/josemendoza/facturacion-app` | No (config + artefactos) |

El repo del backend incluye `server.mjs`, `share-report-server.mjs`, `gmail-oauth.mjs`, `scripts/`,
`ops/`, etc., y tiene la SPA como **submódulo** (`facturacion-react`) apuntando al commit desplegado.

## Dónde está cada cosa

| Qué | Ruta | ¿Versionado? |
|---|---|---|
| Código React | `/Users/josemendoza/Repos/facturacion-react` | Sí (`josepear/facturacion-react`) |
| Código backend | `/Users/josemendoza/Repos/facturacion` | Sí (`josepear/facturacion`) |
| Submódulo React del backend | `<backend>/facturacion-react` | Sí (puntero a commit) |
| Build React | `<react>/dist` | No (generado) |
| Servidor en ejecución | `/Users/josemendoza/facturacion-app/server.mjs` | No (copia del repo) |
| Config de negocio | `/Users/josemendoza/facturacion-app/facturacion.config.json` | No (runtime) |
| Credenciales Gmail | `/Users/josemendoza/facturacion-app/gmail-oauth.local.env` | No (runtime) |
| Sesiones en disco | `/Users/josemendoza/facturacion-app/.facturacion-sessions.json` | No (runtime) |
| SPA publicada (`/react/`) | `/Users/josemendoza/facturacion-app/react-dist` | No (artefacto) |
| Script de deploy | `<backend>/scripts/deploy-to-macmini.sh` (copia en runtime) | Sí (repo backend) |
| LaunchAgent | `~/Library/LaunchAgents/com.pearandco.facturacion.plist` | No |
| Logs | `~/Library/Logs/Facturacion/server.{stdout,stderr}.log` | No |
| Documentos/facturas | `storageDir` del config (`/Volumes/RAID/Datos/facturacion-central/storage`) | No (datos) |

El servidor sirve la SPA desde `react-dist/` (puerto `4311`, rutas `/react/…`) y la API en `/api/…`.

## Trabajo diario: React

```bash
cd /Users/josemendoza/Repos/facturacion-react
npm run dev          # desarrollo
npm run typecheck && npm run lint && npm test && npm run build
```

Commit + push a `main` en `josepear/facturacion-react`.

## Despliegue de la SPA

```bash
cd /Users/josemendoza/Repos/facturacion-react
npm run deploy:local
```

Hace: typecheck + lint + test → build → `rsync dist/ → runtime/react-dist` → reinicia LaunchAgent →
espera `/api/health` → muestra el bundle desplegado. Variables: `FACTURACION_RUNTIME_DIR`,
`FACTURACION_LAUNCHAGENT`, `FACTURACION_HEALTH_URL`, `FACTURACION_SKIP_CHECKS`, `FACTURACION_SKIP_RESTART`.

Fallback manual:

```bash
npm run build
rsync -a --delete dist/ /Users/josemendoza/facturacion-app/react-dist/
launchctl kickstart -k gui/501/com.pearandco.facturacion
```

Verificación:

```bash
curl -fsS http://127.0.0.1:4311/api/health
curl -fsSL https://facturacion.pearandco.es/react/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

El hash debe coincidir con `dist/assets/index-*.js`. Después, `Cmd+Shift+R`.

## Cambios de backend y despliegue completo

1. Editar en `/Users/josemendoza/Repos/facturacion` (nunca en el runtime).
2. Si cambia React: actualizar el submódulo al commit deseado y commitear el puntero.
3. Desplegar desde el repo del backend:

```bash
cd /Users/josemendoza/Repos/facturacion
./scripts/deploy-to-macmini.sh --local
```

Qué hace: `rsync` del monorepo al runtime (sin `.git`, secretos, sesiones, `node_modules`,
`react-dist` ni carpetas solo-runtime), compila React, copia `dist → react-dist`, reinicia el
LaunchAgent y verifica health.

- Fuente React: `FACTURACION_REACT_REPO` (si se define) → clon canónico `~/Repos/facturacion-react` →
  submódulo `<backend>/facturacion-react` (respaldo en máquinas sin el clon).
- Carpetas solo-runtime preservadas: `reports/`, `saas-ui/`, `aider-env/`, `runtime/` (venvs/envs).
- `--local` exige que origen y destino sean distintos (`~/Repos/facturacion` vs `~/facturacion-app`).

## Reglas para no volver a tener dos verdades

1. React: solo en `/Users/josemendoza/Repos/facturacion-react`.
2. Backend: solo en `/Users/josemendoza/Repos/facturacion`.
3. `~/facturacion-app` es runtime: no se edita ni se commitea desde ahí; se actualiza por deploy.
4. No crear copias de `facturacion-react` fuera del repo/submódulo.
5. Artefactos (`dist/`, `react-dist/`, `*.tsbuildinfo`) y secretos nunca se versionan.
6. Antes de cerrar: `typecheck + lint + test + build` en React y `git status` limpio en ambos repos.

## Rollback

React:

```bash
cd /Users/josemendoza/Repos/facturacion-react
git checkout <commit-o-tag>
npm run build
rsync -a --delete dist/ /Users/josemendoza/facturacion-app/react-dist/
launchctl kickstart -k gui/501/com.pearandco.facturacion
git checkout main
```

Backend:

```bash
cd /Users/josemendoza/Repos/facturacion
git checkout <commit-o-tag>
./scripts/deploy-to-macmini.sh --local
git checkout main
```

## Historial de limpieza (2026-11-19)

- Eliminada la copia obsoleta `~/facturacion-app/facturacion-react` (commit antiguo con cambios que
  deshacían features); el runtime ya no guarda código React.
- Eliminado `~/facturacion-app/.gitmodules` (referencia muerta al submódulo).
- Podados worktrees temporales (`/private/tmp/react-*`) y ramas locales duplicadas; solo `main`.
- Backend incluido en Git (`josepear/facturacion`): `server.mjs` y `scripts/deploy-to-macmini.sh`
  versionados, submódulo React actualizado y carpetas solo-runtime excluidas del `--delete`.
