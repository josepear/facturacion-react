# Fuente única y despliegue (React + runtime)

Objetivo: **una sola verdad**. El código vive en un único repositorio Git; el runtime solo contiene
configuración y artefactos de build. No hay copias del proyecto repartidas por la máquina.

## Dónde está cada cosa

| Qué | Ruta | ¿Versionado en Git? |
|---|---|---|
| Código fuente (único original) | `/Users/josemendoza/Repos/facturacion-react` | Sí — `github.com:josepear/facturacion-react.git` |
| Documentación | `<repo>/docs` | Sí |
| Build de la SPA | `<repo>/dist` | No (generado; en `.gitignore`) |
| Servidor Node | `/Users/josemendoza/facturacion-app/server.mjs` | No (runtime) |
| Config de negocio | `/Users/josemendoza/facturacion-app/facturacion.config.json` | No (runtime) |
| Credenciales Gmail | `/Users/josemendoza/facturacion-app/gmail-oauth.local.env` | No (runtime) |
| Sesiones en disco | `/Users/josemendoza/facturacion-app/.facturacion-sessions.json` | No (runtime) |
| Dependencias del servidor | `/Users/josemendoza/facturacion-app/node_modules` | No |
| SPA publicada (`/react/`) | `/Users/josemendoza/facturacion-app/react-dist` | No (artefacto) |
| Script de despliegue | `/Users/josemendoza/facturacion-app/scripts/deploy-to-macmini.sh` | No (runtime) |
| LaunchAgent | `~/Library/LaunchAgents/com.pearandco.facturacion.plist` | No |
| Logs del servidor | `~/Library/Logs/Facturacion/server.{stdout,stderr}.log` | No |

`REPO_DIR` canónico: **`/Users/josemendoza/Repos/facturacion-react`**.
`TARGET_DIR` (runtime): **`/Users/josemendoza/facturacion-app`**.
El servidor sirve la SPA desde `react-dist/` (puerto `4311`, rutas `/react/…`).

## Trabajo diario (solo en el repo canónico)

```bash
cd /Users/josemendoza/Repos/facturacion-react
npm run dev          # desarrollo
npm run typecheck    # TypeScript
npm run lint         # ESLint (debe quedar en 0)
npm test             # Vitest
npm run build        # genera dist/
```

Commits y push **solo** desde este repositorio, en `main` (o rama + PR según
[`git-workflow.md`](git-workflow.md)).

## Despliegue de la SPA (producción)

```bash
cd /Users/josemendoza/Repos/facturacion-react
npm run build
rsync -a --delete dist/ /Users/josemendoza/facturacion-app/react-dist/
launchctl kickstart -k gui/501/com.pearandco.facturacion
```

Verificación:

```bash
curl -fsS http://127.0.0.1:4311/api/health
curl -fsSL https://facturacion.pearandco.es/react/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

Ese hash debe coincidir con `dist/assets/index-*.js`. Después, `Cmd+Shift+R` en el navegador.

### Sobre `deploy-to-macmini.sh`

- Está pensado para sincronizar el monorepo completo al runtime (`rsync` + reinicio + health).
- Su paso React compila desde `FACTURACION_REACT_REPO` si está definido; si no, desde
  `$REPO_DIR/facturacion-react` y, en su defecto, desde el repo canónico
  `/Users/josemendoza/Repos/facturacion-react`.
- En `--local` aborta si origen y destino son el mismo directorio; en este Mac el despliegue
  de la SPA es el bloque de comandos anterior.
- En modo remoto usa `$FACTURACION_REACT_REPO/dist` si existe (hay que compilar antes).

## Reglas para no volver a tener dos verdades

1. No crear copias de `facturacion-react` fuera de `/Users/josemendoza/Repos/facturacion-react`.
2. No editar ni commitear desde `~/facturacion-app` (no es un repo; es el runtime).
3. No reintroducir un submódulo `facturacion-react` dentro del runtime.
4. Los artefactos (`dist/`, `react-dist/`, `*.tsbuildinfo`) nunca se versionan.
5. Antes de cerrar una tarea: `npm run typecheck && npm run lint && npm test && npm run build`,
   y `git status` limpio.

## Rollback

El código está en Git: para volver a una versión anterior basta con

```bash
cd /Users/josemendoza/Repos/facturacion-react
git checkout <commit-o-tag>
npm run build
rsync -a --delete dist/ /Users/josemendoza/facturacion-app/react-dist/
launchctl kickstart -k gui/501/com.pearandco.facturacion
git checkout main
```

## Limpieza aplicada (2026-11-19)

- Eliminada la copia obsoleta `~/facturacion-app/facturacion-react` (estaba en un commit antiguo y
  con cambios que deshacían features).
- Eliminado `~/facturacion-app/.gitmodules` (referencia muerta al submódulo).
- Podados worktrees temporales (`/private/tmp/react-*`) y ramas locales duplicadas (todas existían
  ya en `origin`); queda solo `main`.
