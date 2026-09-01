#!/usr/bin/env bash
#
# Preparacion inicial del servidor. Se ejecuta UNA VEZ como root en 72.60.2.48.
#
#   bash deploy/bootstrap.sh
#
# Deja instalado: Node 22, PostgreSQL, Nginx, Certbot, la aplicacion en
# /opt/bookingly.cloud, el servicio systemd, el proxy inverso, el certificado
# TLS de Let's Encrypt y el temporizador de ingesta cada 2 horas.
#
# Requisito previo: el registro A de bookingly.cloud (y www) debe apuntar ya a
# 72.60.2.48, o Certbot no podra emitir el certificado.
set -euo pipefail

DOMAIN="${DOMAIN:-bookingly.cloud}"
APP_DIR="${APP_DIR:-/opt/bookingly.cloud}"
REPO="${REPO:-https://github.com/c010r/bookingly.cloud.git}"
APP_USER="${APP_USER:-bookingly}"
DB_NAME="${DB_NAME:-bookingly}"
DB_USER="${DB_USER:-bookingly}"
PORT="${PORT:-3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN}}"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

# Diagnostico: si algo falla, decimos en que linea y con que comando, para no
# tener que adivinar leyendo un log de 500 lineas.
trap 'st=$?; echo ""; echo "XXX FALLO en la linea ${LINENO}: ${BASH_COMMAND}"; echo "XXX codigo de salida: ${st}"; exit $st' ERR

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root." >&2
  exit 1
fi

say "Paquetes base"
export DEBIAN_FRONTEND=noninteractive
# En un VPS recien arrancado, unattended-upgrades suele tener el lock de apt.
# DPkg::Lock::Timeout espera hasta 5 min en vez de morir al instante.
APT="apt-get -o DPkg::Lock::Timeout=300"
$APT update -y
# sudo y openssl no vienen en las imagenes minimas de Ubuntu/Debian y este
# script depende de los dos: sin ellos fallaba sin explicar por que.
apt-get install -y sudo openssl curl ca-certificates gnupg git ufw nginx \
  postgresql postgresql-contrib certbot python3-certbot-nginx

echo "Versiones: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | head -1)"

say "Node.js 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  $APT install -y nodejs
fi
node -v

say "Usuario de sistema '${APP_USER}'"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

say "Base de datos PostgreSQL"
systemctl enable --now postgresql
DB_PASS="$(openssl rand -hex 24)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL
if ! sudo -u postgres psql -lqt | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

say "Codigo fuente en ${APP_DIR}"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone --branch main "$REPO" "$APP_DIR"
fi

say "Fichero .env"
ENV_FILE="$APP_DIR/.env"
CREDS_FILE="/root/bookingly-credenciales.txt"
if [ ! -f "$ENV_FILE" ]; then
  # Si GitHub Actions nos pasa una contrasena de panel, la respetamos; si no,
  # la generamos. Nunca se imprime: va a un fichero solo legible por root, para
  # que no acabe en los logs publicos del workflow.
  ADMIN_PASS="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)}"
  cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
PGSSL=0

DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-PENDIENTE_PON_TU_CLAVE}
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-deepseek-chat}

SITE_NAME=${SITE_NAME:-c010r News}
SITE_URL=https://${DOMAIN}
SITE_DESCRIPTION=Noticias de tecnologia, reescritas con criterio.

ADMIN_PASSWORD=${ADMIN_PASS}
AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)

INGEST_MAX_PER_RUN=12
AUTO_PUBLISH=1
AUTO_PUBLISH_MIN_SCORE=78

PORT=${PORT}
NODE_ENV=production
ENV
  cat > "$CREDS_FILE" <<CREDS
Credenciales de ${DOMAIN} — generadas el $(date -Is)

  Panel:              https://${DOMAIN}/admin
  ADMIN_PASSWORD:     ${ADMIN_PASS}
  Base de datos:      ${DB_NAME} / usuario ${DB_USER}

La configuracion completa esta en ${ENV_FILE} (solo root).
Borra este fichero cuando hayas guardado la contrasena en tu gestor.
CREDS
  chmod 600 "$CREDS_FILE"
  echo "Generado ${ENV_FILE}."
  echo "La contrasena del panel esta en ${CREDS_FILE} (no se imprime aqui para que no acabe en los logs)."
else
  # Refrescamos solo la cadena de conexion, respetando el resto de la configuracion.
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}|" "$ENV_FILE"
  # Si el workflow trae una clave de DeepSeek nueva, la actualizamos.
  if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
    sed -i "s|^DEEPSEEK_API_KEY=.*|DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}|" "$ENV_FILE"
    echo "Clave de DeepSeek actualizada."
  fi
  echo "Se conserva el ${ENV_FILE} existente."
  # El puerto elegido en la primera instalacion manda sobre el valor por defecto.
  PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 || true)"
  PORT="${PORT:-3000}"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

say "Dependencias y compilacion"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
cd "$APP_DIR"

# 'sudo -u' conserva HOME=/root, asi que npm intentaba escribir su cache en
# /root/.npm y moria con EACCES. Forzamos HOME y una cache propia del proyecto.
as_app() {
  sudo -H -u "$APP_USER" \
    env HOME="/home/${APP_USER}" \
        npm_config_cache="${APP_DIR}/.npm-cache" \
        "$@"
}
install -d -o "$APP_USER" -g "$APP_USER" "${APP_DIR}/.npm-cache" "/home/${APP_USER}"
chown "$APP_USER:$APP_USER" "/home/${APP_USER}"

as_app npm ci --no-audit --no-fund

# El seeder y la ingesta se ejecutan con tsx, que necesita el binario de
# esbuild. Si su script de instalacion no llego a correr, lo reconstruimos
# antes de que falle mas adelante con un error mucho menos claro.
if ! as_app npx tsx --version >/dev/null 2>&1; then
  echo "tsx no arranca; reconstruyendo esbuild..."
  as_app npm rebuild esbuild || true
  as_app npx tsx --version >/dev/null 2>&1 || {
    echo "XXX tsx sigue sin funcionar. Revisa la instalacion de esbuild." >&2
    exit 1
  }
fi

as_app npm run db:migrate
as_app npm run db:seed
as_app npm run build

say "Servicio systemd"
# En un servidor compartido el puerto puede estar ocupado por otra aplicacion.
if ! systemctl is-active --quiet bookingly.service; then
  if ss -tln | awk '{print $4}' | grep -qE "[:.]${PORT}$"; then
    echo "XXX El puerto ${PORT} ya esta en uso por otro proceso."
    echo "XXX Reejecuta con otro puerto: PORT=3010 bash deploy/bootstrap.sh"
    exit 1
  fi
fi
install -m 644 "$APP_DIR/deploy/bookingly.service" /etc/systemd/system/bookingly.service
install -m 644 "$APP_DIR/deploy/bookingly-ingest.service" /etc/systemd/system/bookingly-ingest.service
install -m 644 "$APP_DIR/deploy/bookingly-ingest.timer" /etc/systemd/system/bookingly-ingest.timer
systemctl daemon-reload
if ! systemctl enable --now bookingly.service; then
  echo "XXX El servicio no arranca. Ultimas lineas del journal:"
  journalctl -u bookingly -n 40 --no-pager || true
  exit 1
fi
systemctl enable --now bookingly-ingest.timer

say "Atajo de despliegue"
install -m 755 "$APP_DIR/deploy/bookingly-deploy" /usr/local/bin/bookingly-deploy
echo "Instalado: bookingly-deploy"

say "Nginx"
sed "s/__DOMAIN__/${DOMAIN}/g; s/__PORT__/${PORT}/g" \
  "$APP_DIR/deploy/nginx-site.conf" > "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

say "Cortafuegos"
# Este servidor aloja mas servicios (correo, docker, otros sitios). Activar un
# cortafuegos que no estaba activo podria cortarlos, asi que solo anadimos
# reglas si el administrador ya lo tenia encendido.
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
else
  echo "ufw inactivo: se deja tal cual."
fi

say "Certificado TLS"
if certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
     --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect; then
  echo "TLS emitido correctamente."
else
  echo "AVISO: Certbot ha fallado. Comprueba que el DNS de ${DOMAIN} apunta a este servidor"
  echo "y repite: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect"
fi

say "Listo"
if systemctl is-active --quiet bookingly.service; then
  echo "Servicio bookingly: activo"
else
  echo "XXX El servicio bookingly NO esta activo. Journal:"
  journalctl -u bookingly -n 40 --no-pager || true
  exit 1
fi

echo
echo "  Sitio:  https://${DOMAIN}"
echo "  Panel:  https://${DOMAIN}/admin"
echo "  Credenciales: ${CREDS_FILE}"
echo

if grep -q '^DEEPSEEK_API_KEY=PENDIENTE' "$ENV_FILE"; then
  echo "  PENDIENTE: no hay clave de DeepSeek. Sin ella no se reescribe nada."
  echo "  Define el secreto DEEPSEEK_API_KEY en GitHub y relanza el workflow,"
  echo "  o editala a mano en ${ENV_FILE} y ejecuta: systemctl restart bookingly"
else
  echo "  Clave de DeepSeek configurada."
fi

echo
echo "  Primera ingesta de prueba:  systemctl start bookingly-ingest"
echo "  Seguirla en vivo:           journalctl -u bookingly-ingest -f"
echo
