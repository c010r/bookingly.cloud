# Despliegue en bookingly.cloud

Servidor: `72.60.2.48` · Dominio: `https://bookingly.cloud` · App en `/opt/bookingly.cloud`

## Arquitectura

```
Internet ──► Nginx :443 (TLS Let's Encrypt) ──► Next.js :3000 (systemd: bookingly)
                                                      │
                                                PostgreSQL local
                                                      ▲
                        systemd timer bookingly-ingest (cada 2 h) ──► npm run ingest
```

La aplicación corre como el usuario de sistema `bookingly`, sin shell. Root solo se usa
para instalar y reiniciar servicios.

---

## Paso 1 — Subir el código a GitHub

El repositorio local ya está inicializado, con el commit hecho y el remoto configurado.
Solo falta el push, que requiere tus credenciales:

```bash
cd C:\Users\Usuario\Desarrollos\c010rNews
git push -u origin main
```

Si el repositorio remoto ya tiene commits (por ejemplo un README creado desde la web):

```bash
git pull --rebase origin main
git push -u origin main
```

## Paso 2 — Apuntar el DNS

Antes de continuar, en tu proveedor de DNS:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `72.60.2.48` |
| A | `www` | `72.60.2.48` |

Verifica que ha propagado antes del paso 3, o Certbot no podrá emitir el certificado:

```bash
nslookup bookingly.cloud
```

## Paso 3 — Preparar el servidor (una sola vez)

```bash
ssh root@72.60.2.48
apt-get update && apt-get install -y git
git clone https://github.com/c010r/bookingly.cloud.git /opt/bookingly.cloud
bash /opt/bookingly.cloud/deploy/bootstrap.sh
```

El script instala Node 22, PostgreSQL, Nginx y Certbot; crea la base de datos con una
contraseña aleatoria; genera el `.env` con secretos aleatorios; compila; levanta el servicio
systemd; configura el proxy inverso; emite el certificado TLS y activa el temporizador de
ingesta.

Al terminar imprime la **contraseña del panel**. Apúntala.

## Paso 4 — Poner la clave de DeepSeek

El bootstrap deja `DEEPSEEK_API_KEY=PENDIENTE_PON_TU_CLAVE`. Sin ella no se reescribe nada:

```bash
nano /opt/bookingly.cloud/.env      # pon tu clave real
systemctl restart bookingly
```

Primera ingesta de prueba (3 noticias, coste mínimo):

```bash
sudo -u bookingly bash -c 'cd /opt/bookingly.cloud && npm run ingest -- --max=3'
```

## Paso 5 — Despliegue automático en cada push

Genera una clave SSH dedicada al despliegue (no reutilices la tuya personal):

```bash
# En el servidor
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/gh_deploy -N ""
cat /root/.ssh/gh_deploy.pub >> /root/.ssh/authorized_keys
cat /root/.ssh/gh_deploy          # copia esta clave privada entera
```

En GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Valor |
|---|---|
| `SSH_HOST` | `72.60.2.48` |
| `SSH_USER` | `root` |
| `SSH_KEY` | el contenido de `/root/.ssh/gh_deploy` (clave privada completa) |

A partir de ahí, cada push a `main` ejecuta `.github/workflows/deploy.yml`: comprueba tipos,
corre los tests, compila, y solo si todo pasa entra por SSH y ejecuta `deploy/deploy.sh`
(pull, dependencias, migraciones, build, reinicio y comprobación de salud). Si algo falla
durante el despliegue, hace *rollback* al commit anterior automáticamente.

---

## Operación diaria

```bash
systemctl status bookingly              # estado
journalctl -u bookingly -f              # logs en vivo
journalctl -u bookingly-ingest -n 100   # última ingesta
systemctl list-timers bookingly-ingest  # próxima ejecución
systemctl start bookingly-ingest        # forzar una ingesta ahora

bash /opt/bookingly.cloud/deploy/deploy.sh   # desplegar a mano
```

Base de datos:

```bash
sudo -u postgres psql bookingly
\dt                                     # tablas
SELECT status, count(*) FROM articles GROUP BY status;
```

Copia de seguridad:

```bash
sudo -u postgres pg_dump bookingly | gzip > /root/bookingly-$(date +%F).sql.gz
```

## Seguridad

Cosas que conviene hacer, en orden de importancia:

1. **Rota la contraseña de root.** La compartiste en texto plano en un chat, así que debe
   considerarse comprometida: `passwd root`.
2. **Desactiva el acceso por contraseña** una vez tengas tu clave SSH funcionando. En
   `/etc/ssh/sshd_config`: `PasswordAuthentication no`, luego `systemctl restart ssh`.
3. El `.env` del servidor tiene permisos `600` y no está en git. No lo commitees nunca.
4. `ADMIN_PASSWORD` protege `/admin`; la cookie va firmada con HMAC y caduca a los 7 días.
5. El endpoint `/api/cron/ingest` exige `Authorization: Bearer $CRON_SECRET`. El temporizador
   de systemd no lo usa (llama directamente al script), así que puedes dejarlo cerrado.

## Nota sobre el nombre

El dominio es `bookingly.cloud` pero el medio se llama *c010r News* (`SITE_NAME` en el
`.env`). Si quieres que el sitio se llame de otra forma, cambia esa variable y reinicia;
no hace falta tocar código.
