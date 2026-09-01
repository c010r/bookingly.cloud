#!/usr/bin/env bash
#
# Actualiza la aplicacion ya instalada. Es lo que ejecuta GitHub Actions en cada
# push a main, y tambien sirve para desplegar a mano:
#
#   bash /opt/bookingly.cloud/deploy/deploy.sh
#
# Idempotente y con vuelta atras: si la compilacion falla, el servicio sigue
# corriendo con la version anterior.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bookingly.cloud}"
APP_USER="${APP_USER:-bookingly}"
SERVICE="${SERVICE:-bookingly}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3000}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
trap 'st=$?; echo ""; echo "XXX FALLO en la linea ${LINENO}: ${BASH_COMMAND}"; echo "XXX codigo de salida: ${st}"; exit $st' ERR

# npm con 'sudo -u' hereda HOME=/root y falla al escribir su cache; le damos
# HOME y cache propios, igual que hace bootstrap.sh.
as_app() {
  sudo -H -u "$APP_USER" \
    env HOME="/home/${APP_USER}" \
        npm_config_cache="${APP_DIR}/.npm-cache" \
        "$@"
}

cd "$APP_DIR"
PREVIOUS="$(git rev-parse HEAD)"

say "Descargando ${BRANCH}"
git fetch --all --prune
git reset --hard "origin/${BRANCH}"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

rollback() {
  say "FALLO: volviendo a ${PREVIOUS}"
  git reset --hard "$PREVIOUS"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  as_app npm ci --no-audit --no-fund || true
  as_app npm run build || true
  systemctl restart "$SERVICE"
  exit 1
}
trap rollback ERR

say "Dependencias"
as_app npm ci --no-audit --no-fund

say "Migraciones"
as_app npm run db:migrate

say "Compilacion"
as_app npm run build

trap - ERR

say "Reiniciando ${SERVICE}"
systemctl restart "$SERVICE"

# Esperamos a que responda antes de dar el despliegue por bueno.
say "Comprobacion de salud"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    echo "La aplicacion responde. Desplegado $(git rev-parse --short HEAD)."
    exit 0
  fi
  sleep 2
done

echo "La aplicacion no responde tras 40 s. Revisa: journalctl -u ${SERVICE} -n 80" >&2
exit 1
