# Despliegue de c010r News

Proyecto: **c010r News** · Dominio: `https://bookingly.cloud` · Servidor: `72.60.2.48`

Todo el despliegue se hace desde **GitHub Actions**. No hace falta entrar por SSH a mano:
los runners de GitHub se conectan al servidor por ti.

## Arquitectura

```
push a main ──► GitHub Actions ──(SSH)──► 72.60.2.48
                  verifica                    │
                  tipos + tests + build       ▼
                                        deploy.sh: pull, npm ci,
                                        migraciones, build, restart

Internet ──► Nginx :443 (TLS Let's Encrypt) ──► Next.js :3000 (systemd: bookingly)
                                                      │
                                                PostgreSQL local
                                                      ▲
                        systemd timer bookingly-ingest (cada 2 h) ──► npm run ingest
```

La aplicación corre como el usuario de sistema `bookingly`, sin shell. Root solo se usa para
instalar y reiniciar servicios.

---

## Paso 1 — Configurar los secretos

En GitHub → **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Obligatorio | Valor |
|---|---|---|
| `SSH_HOST` | sí | `72.60.2.48` |
| `SSH_USER` | sí | `root` |
| `SSH_KEY` | ver abajo | Clave privada SSH completa (**recomendado**) |
| `SSH_PASSWORD` | ver abajo | Contraseña de root (alternativa a `SSH_KEY`) |
| `DEEPSEEK_API_KEY` | sí | Tu clave de `platform.deepseek.com` |
| `ADMIN_PASSWORD` | no | Contraseña del panel; si falta, se genera una |
| `SSH_PORT` | no | Solo si SSH no está en el 22 |

Hace falta **`SSH_KEY` o `SSH_PASSWORD`**, no las dos. Si defines ambas se usa la clave.

### Por qué conviene `SSH_KEY` en vez de la contraseña

La contraseña de root que se compartió por chat debe considerarse comprometida, y además
Ubuntu trae `PermitRootLogin prohibit-password` por defecto, que **rechaza el login de root
por contraseña aunque sea la correcta**. Si el workflow falla con
`Permission denied (publickey,password)`, es casi seguro eso.

Desde la consola del proveedor (VNC / consola web del VPS):

```bash
# 1. Rota la contraseña comprometida
passwd root

# 2. Genera una clave dedicada al despliegue
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/gh_deploy -N ""
cat /root/.ssh/gh_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# 3. Muestra la clave privada y pégala entera en el secreto SSH_KEY
cat /root/.ssh/gh_deploy
```

Copia desde `-----BEGIN OPENSSH PRIVATE KEY-----` hasta `-----END OPENSSH PRIVATE KEY-----`,
ambas líneas incluidas.

Si prefieres tirar de contraseña, en `/etc/ssh/sshd_config` pon `PermitRootLogin yes` y
`systemctl restart ssh`. Funciona, pero deja el servidor expuesto a fuerza bruta contra root.

## Paso 2 — DNS

Ya está correcto: `bookingly.cloud` resuelve a `72.60.2.48`. No hay que tocar nada.

Si algún día cambia, los registros son `A @ → 72.60.2.48` y `A www → 72.60.2.48`.
Certbot necesita que el DNS esté propagado o no podrá emitir el certificado.

## Paso 3 — Instalar el servidor (una sola vez)

En GitHub → pestaña **Actions** → workflow **«Preparar el servidor (una sola vez)»** →
**Run workflow**:

- `dominio`: `bookingly.cloud`
- `confirmar`: escribe `SI` en mayúsculas

El workflow entra por SSH y ejecuta `deploy/bootstrap.sh`, que instala Node 22, PostgreSQL,
Nginx y Certbot; crea la base de datos con contraseña aleatoria; escribe el `.env` con
secretos generados y tu clave de DeepSeek; carga las 45 fuentes RSS; compila; levanta el
servicio systemd; configura el proxy inverso; emite el certificado TLS y activa el
temporizador de ingesta. Al final comprueba que `https://bookingly.cloud` devuelve 200.

Tarda entre 5 y 10 minutos.

**La contraseña del panel no se imprime en los logs** (serían visibles para cualquiera con
acceso al repo). Queda en el servidor:

```bash
cat /root/bookingly-credenciales.txt
```

Si prefieres elegirla tú, define el secreto `ADMIN_PASSWORD` antes de lanzar el workflow.

## Paso 4 — Despliegue continuo

Ya no hay que hacer nada más. Cada push a `main` dispara **«Desplegar en bookingly.cloud»**:

1. Comprueba tipos (`tsc --noEmit`), corre `scripts/selftest.ts` y compila.
2. Solo si todo pasa, entra por SSH y ejecuta `deploy/deploy.sh`.
3. `deploy.sh` hace pull, `npm ci`, migraciones, build, reinicio y comprobación de salud.
   **Si algo falla, vuelve automáticamente al commit anterior** y reinicia con la versión
   que funcionaba.
4. El workflow verifica desde fuera que `https://bookingly.cloud` sigue devolviendo 200.

Los cambios que solo tocan `.md` no disparan despliegue.

También puedes lanzarlo a mano desde **Actions → Desplegar en bookingly.cloud → Run workflow**.

## Paso 5 — Primera ingesta

El temporizador corre cada 2 horas por su cuenta. Para no esperar:

```bash
systemctl start bookingly-ingest
journalctl -u bookingly-ingest -f
```

O desde el panel, en `https://bookingly.cloud/admin`, con el botón **Ingerir noticias**.

Con `AUTO_PUBLISH=1` (el valor por defecto) las piezas que saquen 78 o más se publican solas;
el resto se queda en borradores esperando tu revisión.

---

## Operación

```bash
systemctl status bookingly              # estado
journalctl -u bookingly -f              # logs en vivo
journalctl -u bookingly-ingest -n 100   # última ingesta
systemctl list-timers bookingly-ingest  # próxima ejecución

bash /opt/bookingly.cloud/deploy/deploy.sh   # desplegar a mano
```

Base de datos:

```bash
sudo -u postgres psql bookingly
SELECT status, count(*) FROM articles GROUP BY status;
SELECT category, count(*) FROM articles WHERE status='published' GROUP BY category;
```

Copia de seguridad:

```bash
sudo -u postgres pg_dump bookingly | gzip > /root/bookingly-$(date +%F).sql.gz
```

## Ajustes habituales

Todo vive en `/opt/bookingly.cloud/.env`; tras editarlo, `systemctl restart bookingly`.

| Variable | Para qué |
|---|---|
| `AUTO_PUBLISH` | `0` deja todo en borrador y devuelve el control editorial a una persona |
| `AUTO_PUBLISH_MIN_SCORE` | Sube el listón (más estricto) o bájalo (más volumen) |
| `INGEST_MAX_PER_RUN` | Artículos nuevos por ejecución; controla el gasto en DeepSeek |
| `DEEPSEEK_MODEL` | `deepseek-reasoner` para piezas más elaboradas y más caras |

## Seguridad

1. **Rota la contraseña de root**: se compartió en texto plano por chat.
2. Con `SSH_KEY` funcionando, desactiva el acceso por contraseña:
   `PasswordAuthentication no` en `/etc/ssh/sshd_config` y `systemctl restart ssh`.
3. El `.env` del servidor tiene permisos `600` y está en `.gitignore`. Nunca lo commitees.
4. El panel `/admin` va con cookie firmada por HMAC, caduca a los 7 días, y Nginx le añade
   `X-Robots-Tag: noindex`.
5. `/api/cron/ingest` exige `Authorization: Bearer $CRON_SECRET`. El temporizador de systemd
   no lo usa (llama al script directamente), así que puedes dejar el endpoint cerrado.
6. Borra `/root/bookingly-credenciales.txt` cuando hayas guardado la contraseña del panel.
