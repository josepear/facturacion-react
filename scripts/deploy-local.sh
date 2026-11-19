#!/bin/sh
# Despliegue local de la SPA (build + copia a react-dist + reinicio + health).
# Uso: npm run deploy:local
#   FACTURACION_RUNTIME_DIR   Directorio del runtime (por defecto ~/facturacion-app)
#   FACTURACION_LAUNCHAGENT   Etiqueta del LaunchAgent (por defecto com.pearandco.facturacion)
#   FACTURACION_SKIP_CHECKS=1 No ejecuta typecheck/lint/tests
#   FACTURACION_SKIP_RESTART=1 No reinicia el servicio
set -eu

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
RUNTIME_DIR="${FACTURACION_RUNTIME_DIR:-$HOME/facturacion-app}"
REACT_DIST="$RUNTIME_DIR/react-dist"
LABEL="${FACTURACION_LAUNCHAGENT:-com.pearandco.facturacion}"
HEALTH_URL="${FACTURACION_HEALTH_URL:-http://127.0.0.1:4311/api/health}"

echo "Repo:    $REPO_DIR"
echo "Runtime: $RUNTIME_DIR"

if [ ! -d "$RUNTIME_DIR" ]; then
  echo "ERROR: no existe el runtime $RUNTIME_DIR" >&2
  exit 1
fi

cd "$REPO_DIR"

if [ "${FACTURACION_SKIP_CHECKS:-}" != "1" ]; then
  npm run typecheck
  npm run lint
  npm test
fi

npm run build
mkdir -p "$REACT_DIST"
rsync -a --delete "$REPO_DIR/dist/" "$REACT_DIST/"
echo "SPA copiada a $REACT_DIST"

if [ "${FACTURACION_SKIP_RESTART:-}" != "1" ]; then
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
  echo "LaunchAgent reiniciado: $LABEL"
fi

attempt=0
until curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 15 ]; then
    echo "ERROR: $HEALTH_URL no responde tras el despliegue" >&2
    exit 1
  fi
  sleep 1
done

BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$REPO_DIR/dist/index.html" | head -1)
echo "Health OK. Bundle desplegado: $BUNDLE"
echo "Recuerda recargar con Cmd+Shift+R."
