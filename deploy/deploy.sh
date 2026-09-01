#!/usr/bin/env bash
#
# Actualiza la aplicacion ya instalada. Es lo que ejecuta GitHub Actions en cada
# push a main, y tambien sirve para desplegar a mano:
#
#   ssh root@72.60.2.48 'bash /opt/bookingly.cloud/deploy/deploy.sh'
#
# Idempotente y con vuelta atras: si la compilacion falla, el servicio sigue
# corriendo con la version anterior.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bookingly.cloud}"
APP_USER="${APP_USER:-bookingly}"
SERVICE="${SERVICE:-bookingly}"
BRANCH="${BRANCH:-main}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

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
  sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund || true
  sudo -u "$APP_USER" npm run build || true
  systemctl restart "$SERVICE"
  exit 1
}
trap rollback ERR

say "Dependencias"
sudo -u "$APP_USER" npm ci --no-audit --no-fund

say "Migraciones"
sudo -u "$APP_USER" npm run db:migrate

say "Compilacion"
sudo -u "$APP_USER" npm run build

trap - ERR

say "Reiniciando ${SERVICE}"
systemctl restart "$SERVICE"

# Esperamos a que responda antes de dar el despliegue por bueno.
say "Comprobacion de salud"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3000}/"; then
    echo "La aplicacion responde. Desplegado $(git rev-parse --short HEAD)."
    exit 0
  fi
  sleep 2
done

echo "La aplicacion no responde tras 40 s. Revisa: journalctl -u ${SERVICE} -n 80" >&2
exit 1
