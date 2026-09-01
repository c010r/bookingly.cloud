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

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root." >&2
  exit 1
fi

say "Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git ufw nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx

say "Node.js 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
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
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
PGSSL=0

DEEPSEEK_API_KEY=PENDIENTE_PON_TU_CLAVE
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

SITE_NAME=c010r News
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
  echo "Generado ${ENV_FILE}. Contrasena del panel: ${ADMIN_PASS}"
else
  # Refrescamos solo la cadena de conexion, respetando el resto de la configuracion.
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}|" "$ENV_FILE"
  echo "Se conserva el ${ENV_FILE} existente."
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

say "Dependencias y compilacion"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npx --yes esbuild --version >/dev/null 2>&1 || true
sudo -u "$APP_USER" npm run db:migrate
sudo -u "$APP_USER" npm run db:seed
sudo -u "$APP_USER" npm run build

say "Servicio systemd"
install -m 644 "$APP_DIR/deploy/bookingly.service" /etc/systemd/system/bookingly.service
install -m 644 "$APP_DIR/deploy/bookingly-ingest.service" /etc/systemd/system/bookingly-ingest.service
install -m 644 "$APP_DIR/deploy/bookingly-ingest.timer" /etc/systemd/system/bookingly-ingest.timer
systemctl daemon-reload
systemctl enable --now bookingly.service
systemctl enable --now bookingly-ingest.timer

say "Nginx"
sed "s/__DOMAIN__/${DOMAIN}/g; s/__PORT__/${PORT}/g" \
  "$APP_DIR/deploy/nginx-site.conf" > "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

say "Cortafuegos"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

say "Certificado TLS"
if certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
     --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect; then
  echo "TLS emitido correctamente."
else
  echo "AVISO: Certbot ha fallado. Comprueba que el DNS de ${DOMAIN} apunta a este servidor"
  echo "y repite: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect"
fi

say "Listo"
systemctl --no-pager status bookingly.service | head -12
cat <<FIN

  Sitio:  https://${DOMAIN}
  Panel:  https://${DOMAIN}/admin

  PENDIENTE: edita ${ENV_FILE} y pon tu DEEPSEEK_API_KEY real,
  despues:   systemctl restart bookingly

  Primera ingesta manual:
    sudo -u ${APP_USER} bash -c 'cd ${APP_DIR} && npm run ingest -- --max=3'

FIN
