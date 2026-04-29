# Git: ramas y commits (facturacion-react)

## Ramas

- **`main`**: línea estable; solo entra con PR revisado (o merge explícito acordado).
- **`codex/<tema>`**: trabajo por iniciativa (p. ej. `codex/facturar-react-core`).
- **`codex/next-parity-pass`**: integración de paridad legacy → React; cuando esté lista, **PR único a `main`** o, si crece mucho, **varios PRs temáticos** desde commits ya ordenados (rebase interactivo o cherry-pick).

Evitar mezclar en la misma rama temas no relacionados (p. ej. Facturar + Gastos + nav) si el objetivo es revisión clara: o bien commits atómicos consecutivos en la misma rama, o ramas cortas que se fusionan en la de integración.

## Commits

- **Un tema por commit** cuando sea razonable: `feat(settings): …`, `fix(nav): …`, `chore: …`, `test: …`.
- **Mensaje en español** acorde al repo; primera línea ~72 caracteres; cuerpo opcional con el “por qué”.
- **No commitear** notas locales de sesión: `docs/cursor-session-handoff.md` está en `.gitignore`.

## Limpieza del árbol de trabajo

- Revisar `git status` antes de cerrar sesión; borrar artefactos accidentales (p. ej. ficheros `Icon` de macOS en carpetas del repo).
- Tras un fallo de git con `index.lock`, eliminar `.git/index.lock` solo si no hay otro proceso usando el repo.

## Publicar

- Push de la rama de trabajo y abrir PR hacia `main` (o hacia la rama de integración acordada).
- El despliegue al mini sigue el runbook del monorepo padre (`./scripts/deploy-to-macmini.sh` desde la raíz de facturación).
