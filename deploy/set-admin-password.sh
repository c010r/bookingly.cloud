#!/usr/bin/env bash
#
# Cambia la contrasena del panel sin que aparezca en pantalla, ni en el
# historial del shell, ni en los logs.
#
#   ssh -t bookingly 'bash /opt/bookingly.cloud/deploy/set-admin-password.sh'
#
# Con --generar pone una aleatoria y la deja en el fichero de credenciales.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/bookingly.cloud}"
ENV_FILE="$APP_DIR/.env"
CREDS_FILE="/root/bookingly-credenciales.txt"
SERVICE="${SERVICE:-bookingly}"

[ -f "$ENV_FILE" ] || { echo "No encuentro $ENV_FILE" >&2; exit 1; }

# Rotar AUTH_SECRET invalida la firma de todas las cookies emitidas, asi que
# cierra cualquier sesion abierta sin tocar la contrasena.
if [ "${1:-}" = "--cerrar-sesiones" ]; then
  NUEVO_SECRET="$(openssl rand -hex 32)"
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${NUEVO_SECRET}|" "$ENV_FILE"
  systemctl restart "$SERVICE"
  echo "Sesiones cerradas: habra que volver a entrar en el panel."
  exit 0
fi

if [ "${1:-}" = "--generar" ]; then
  NUEVA="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  echo "Contrasena generada. Queda en ${CREDS_FILE}."
else
  # -s: no se muestra al teclearla.
  read -r -s -p "Nueva contrasena del panel: " NUEVA; echo
  read -r -s -p "Repitela: " CONFIRMA; echo

  if [ "$NUEVA" != "$CONFIRMA" ]; then
    echo "No coinciden. No se ha cambiado nada." >&2
    exit 1
  fi
  if [ ${#NUEVA} -lt 12 ]; then
    echo "Demasiado corta: minimo 12 caracteres. No se ha cambiado nada." >&2
    exit 1
  fi
fi

# Escribimos con python para no pelearnos con los caracteres especiales que
# sed interpretaria (barras, ampersands, pipes...).
NUEVA="$NUEVA" python3 - "$ENV_FILE" <<'PY'
import os, sys, re
ruta = sys.argv[1]
nueva = os.environ["NUEVA"]
with open(ruta, encoding="utf-8") as f:
    lineas = f.read().splitlines()
salida, encontrada = [], False
for l in lineas:
    if re.match(r"^ADMIN_PASSWORD=", l):
        salida.append(f"ADMIN_PASSWORD={nueva}")
        encontrada = True
    else:
        salida.append(l)
if not encontrada:
    salida.append(f"ADMIN_PASSWORD={nueva}")
with open(ruta, "w", encoding="utf-8") as f:
    f.write("\n".join(salida) + "\n")
PY

chmod 600 "$ENV_FILE"

# Dejamos constancia en el fichero de credenciales, solo legible por root.
NUEVA="$NUEVA" python3 - "$CREDS_FILE" <<'PY'
import os, sys, datetime
ruta = sys.argv[1]
with open(ruta, "w", encoding="utf-8") as f:
    f.write(
        "Credenciales del panel de c010r News\n"
        f"Actualizadas el {datetime.datetime.now().isoformat(timespec='seconds')}\n\n"
        "  Panel:           https://bookingly.cloud/admin\n"
        f"  ADMIN_PASSWORD:  {os.environ['NUEVA']}\n\n"
        "Guardala en tu gestor de contrasenas y borra este fichero.\n"
    )
PY
chmod 600 "$CREDS_FILE"

systemctl restart "$SERVICE"

# La cookie de sesion va firmada con AUTH_SECRET, que no cambia: las sesiones
# ya abiertas siguen validas. Avisamos por si se quiere cerrarlas.
echo
echo "Contrasena cambiada y servicio reiniciado."
echo "Copia guardada en ${CREDS_FILE}"
echo
echo "Las sesiones abiertas siguen activas. Para cerrarlas todas:"
echo "  ssh bookingly 'bash ${APP_DIR}/deploy/set-admin-password.sh --cerrar-sesiones'"
