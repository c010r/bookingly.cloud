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

# El puerto manda el .env, que es de donde lo lee systemd. Estaba fijo en 3000
# y esta aplicacion escucha en el 3010: como el servidor aloja otros diez
# sitios, la comprobacion de salud daba por bueno el despliegue mirando la
# respuesta de un vecino. Un valor del entorno solo sirve de respaldo, porque
# cambiarlo no cambia el puerto en el que arranca la aplicacion.
PORT_ENV="$(sed -n 's/^PORT=//p' "${APP_DIR}/.env" 2>/dev/null | tail -1 | tr -d '"'"'"' ' || true)"
PORT="${PORT_ENV:-${PORT:-3000}}"

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

# El repositorio pertenece a $APP_USER pero git lo ejecuta root: sin esto,
# git aborta con "detected dubious ownership" y el despliegue no descarga nada.
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true

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
# Que algo conteste en el puerto no prueba nada: hay que confirmar que quien
# escucha es nuestro servicio. Se mira el cgroup del proceso, que en systemd
# lleva el nombre de la unidad. Si no se puede averiguar (sin ss, o sin
# permisos) no se aborta el despliegue: se avisa y vale la respuesta HTTP.
pid_del_puerto() {
  command -v ss >/dev/null 2>&1 || return 1
  ss -tlnp 2>/dev/null \
    | awk -v puerto=":${PORT}\$" '$4 ~ puerto {print}' \
    | sed -n 's/.*pid=\([0-9]\{1,\}\).*/\1/p' \
    | head -1
}

escucha_nuestro_servicio() {
  local pid
  pid="$(pid_del_puerto || true)"
  [ -n "$pid" ] || return 2
  [ -r "/proc/${pid}/cgroup" ] || return 2
  grep -q "${SERVICE}" "/proc/${pid}/cgroup"
}

say "Comprobacion de salud"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/"; then
    # Con 'set -e' no se puede llamar y mirar $? despues: el fallo abortaria
    # el script antes de leerlo.
    estado=0
    escucha_nuestro_servicio || estado=$?
    case $estado in
      0) echo "La aplicacion responde en el puerto ${PORT}. Desplegado $(git rev-parse --short HEAD)."
         exit 0 ;;
      2) echo "La aplicacion responde en el puerto ${PORT} (no se pudo verificar el proceso)."
         echo "Desplegado $(git rev-parse --short HEAD)."
         exit 0 ;;
      *) echo "XXX El puerto ${PORT} responde, pero lo ocupa otro servicio, no ${SERVICE}." >&2
         echo "XXX Revisa PORT en ${APP_DIR}/.env y quien tiene cogido el puerto: ss -tlnp | grep ${PORT}" >&2
         exit 1 ;;
    esac
  fi
  sleep 2
done

echo "La aplicacion no responde en el puerto ${PORT} tras 40 s." >&2
echo "Revisa: journalctl -u ${SERVICE} -n 80" >&2
exit 1
