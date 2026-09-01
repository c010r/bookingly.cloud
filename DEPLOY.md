# Despliegue de c010r News

Proyecto: **c010r News** · Dominio: `https://bookingly.cloud` · Servidor: `72.60.2.48`

El servidor tiene un clon del repositorio en `/opt/bookingly.cloud`. Desplegar es entrar y
ejecutar un comando. GitHub solo verifica que el código está sano; no toca el servidor.

```
git push ──► GitHub Actions verifica (tipos, tests, build)
                     │
                     ▼  si está en verde, es seguro desplegar
              ssh bookingly && bookingly-deploy
                     │
                     ▼
              git pull, npm ci, migraciones, build, restart
              (si algo falla, vuelve solo al commit anterior)
```

## Desplegar

```bash
ssh bookingly
bookingly-deploy
```

Eso es todo. El script hace `git fetch` + `reset --hard origin/main`, instala dependencias,
aplica migraciones, compila y reinicia el servicio. Espera a que la aplicación responda antes
de darlo por bueno, y **si cualquier paso falla vuelve automáticamente al commit anterior**
y reinicia con la versión que funcionaba.

Otros usos del mismo comando:

| Comando | Qué hace |
|---|---|
| `bookingly-deploy` | Despliega `origin/main` |
| `bookingly-deploy --status` | Estado del servicio y versión desplegada |
| `bookingly-deploy --logs` | Logs de la aplicación en vivo |
| `bookingly-deploy --ingest` | Lanza una ingesta ahora y la sigue |

## El alias `ssh bookingly`

Ya está en `~/.ssh/config` de esta máquina, apuntando a la clave `~/.ssh/bookingly_deploy`.
Incluye un `ProxyCommand` porque esta red solo permite salir por un proxy HTTP; **desde otra
red, borra esa línea** y el resto funciona igual.

## Qué hay instalado

| | |
|---|---|
| Aplicación | `/opt/bookingly.cloud`, usuario de sistema `bookingly`, puerto **3010** |
| Servicio | `bookingly.service`, arranca `next start` con node directamente |
| Ingesta | `bookingly-ingest.timer`, cada 2 h |
| Base de datos | `bookingly` en el PostgreSQL 16 ya existente del servidor |
| Nginx | virtual host `bookingly.cloud`, junto a los otros sitios del servidor |
| TLS | Let's Encrypt con renovación automática |

El servidor es **compartido**: aloja otros diez sitios, Postfix y varios contenedores Docker.
Por eso se usa el puerto 3010 (el 3000 lo tiene `markless`) y **el bootstrap no activa ufw**,
que está desactivado a propósito: encenderlo cortaría servicios ajenos.

## Reinstalar desde cero

Solo si hace falta rehacer el servidor. Es idempotente, se puede repetir:

```bash
ssh bookingly
git -C /opt/bookingly.cloud pull
DOMAIN=bookingly.cloud PORT=3010 bash /opt/bookingly.cloud/deploy/bootstrap.sh
```

Instala Node 22, PostgreSQL, Nginx y Certbot; crea la base con contraseña aleatoria; escribe
el `.env`; carga las 45 fuentes; compila; levanta systemd; configura el proxy inverso; emite
el TLS e instala el atajo `bookingly-deploy`.

Acepta por entorno: `DOMAIN`, `PORT`, `LLM_API_KEY`, `ADMIN_PASSWORD`, `SITE_NAME`.

## Configuración

Todo vive en `/opt/bookingly.cloud/.env` (permisos `600`, fuera de git). Tras editarlo:
`systemctl restart bookingly`.

| Variable | Para qué |
|---|---|
| `LLM_API_KEY` | Sin ella no se reescribe nada. Gratis en <https://console.groq.com/keys> |
| `AUTO_PUBLISH` | `0` deja todo en borrador y devuelve el control editorial a una persona |
| `AUTO_PUBLISH_MIN_SCORE` | Sube el listón (más estricto) o bájalo (más volumen) |
| `INGEST_MAX_PER_RUN` | Artículos nuevos por ejecución; controla el consumo de cuota |
| `LLM_MODEL` | Modelo a usar. Por defecto `openai/gpt-oss-120b` (Groq) |
| `LLM_BASE_URL` | Cambia de proveedor: vale cualquier API compatible con OpenAI |

La contraseña del panel está en `/root/bookingly-credenciales.txt`. Guárdala en tu gestor y
borra el fichero.

## Operación

```bash
bookingly-deploy --status                    # estado y versión
bookingly-deploy --logs                      # logs en vivo
journalctl -u bookingly-ingest -n 100        # última ingesta
systemctl list-timers bookingly-ingest       # próxima ejecución

sudo -u postgres psql bookingly -c "SELECT status, count(*) FROM articles GROUP BY status;"
sudo -u postgres pg_dump bookingly | gzip > /root/bookingly-$(date +%F).sql.gz
```

## Seguridad

1. **Rota la contraseña de root**: se compartió en texto plano por chat.
2. Con la clave SSH funcionando, desactiva el acceso por contraseña:
   `PasswordAuthentication no` en `/etc/ssh/sshd_config` y `systemctl restart ssh`.
3. El repositorio es **público**: nunca commitees el `.env` ni pegues secretos en los
   workflows. Por eso las credenciales generadas van a un fichero del servidor y no a un log.
4. El panel `/admin` usa cookie firmada con HMAC (7 días) y Nginx le añade `X-Robots-Tag:
   noindex`.
