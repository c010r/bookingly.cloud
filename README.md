# c010r News

Medio digital de noticias de tecnología. Rastrea feeds RSS, detecta cuándo varios medios
cuentan la misma noticia, la reescribe con voz propia usando DeepSeek, la clasifica en una
sección y decide por sí mismo si tiene calidad para publicarse.

## Cómo funciona

```
Feeds RSS  ──►  ¿URL ya vista?          ──► sí: descartar
   (45)         ¿misma noticia que otra? ──► sí: añadir el medio como fuente adicional
                        │ no
                        ▼
              Extraer el artículo completo
                        │
                        ▼
              Reescritura con DeepSeek
              (voz de periodista, categoría, autoevaluación 0-100)
                        │
                        ▼
              ¿nota >= AUTO_PUBLISH_MIN_SCORE?
                 sí → publicado          no → borrador para revisión
```

### Detección de noticias repetidas

Dos niveles, ambos en `src/lib/dedupe.ts`, sin extensiones de Postgres:

1. **Misma URL** — hash normalizado (sin `utm`, sin barra final, sin mayúsculas).
2. **Misma noticia en otro medio** — similitud de Jaccard sobre bigramas de palabras del
   titular (55%) más solape de entidades: nombres propios y cifras (45%). Ventana de 72 h,
   umbral 0,42.

Cuando detecta una repetición **no descarta la noticia**: añade ese medio a `extra_sources`
del artículo existente, y la ficha pasa a mostrar "3 fuentes" con todos los enlaces.

Limitación conocida: entre idiomas distintos (una noticia en inglés y su versión en español)
la similitud cae al rango 0,45-0,55 y depende de que coincidan nombres propios y cifras.
Funciona en la mayoría de casos, pero no es infalible. Para cobertura total haría falta
comparar embeddings, no texto.

### Control de publicación

Lo tiene el sistema, no una persona. En cada reescritura el modelo se autoevalúa de 0 a 100,
y esa nota se corrige con heurísticas objetivas del texto (`applyHeuristics` en
`src/lib/rewriter.ts`): penaliza muletillas de IA ("en resumen", "cabe destacar", "sin duda"),
textos demasiado cortos o largos, titulares fuera de rango y piezas sin un solo dato numérico.

- Nota ≥ `AUTO_PUBLISH_MIN_SCORE` (78 por defecto) → **se publica sola**.
- Por debajo → queda en borradores, con la nota y el motivo a la vista en el panel.

Con `AUTO_PUBLISH=0` todo queda en borrador y el control vuelve a ser manual.

### Atribución

Cada noticia guarda y muestra el medio original, su titular y el enlace, más todos los medios
adicionales detectados como duplicados. Aparece en el pie del artículo, en `schema.org`
(`citation`) y en el feed RSS propio.

## Puesta en marcha

```bash
cp .env.example .env      # rellena DATABASE_URL, DEEPSEEK_API_KEY, ADMIN_PASSWORD, AUTH_SECRET, CRON_SECRET
npm install
npm run db:migrate        # crea el esquema (idempotente)
npm run db:seed           # carga las 45 fuentes RSS
npm run dev               # http://localhost:3000
```

Genera los secretos con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Producción |
| `npm run db:migrate` | Aplica `db/schema.sql` |
| `npm run db:seed` | Carga las fuentes RSS |
| `npm run db:seed -- --check` | Además comprueba que cada feed responde |
| `npm run ingest` | Ingesta completa |
| `npm run ingest -- --max=3` | Solo 3 noticias nuevas |
| `npm run ingest -- --dry` | Simula sin gastar tokens de DeepSeek |
| `npm run ingest -- --source=7` | Solo una fuente |
| `npx tsx scripts/check-feed.ts <url>` | Prueba un feed suelto sin tocar la base de datos |
| `npx tsx scripts/selftest.ts` | Test de los helpers puros (dedupe, slugs, markdown) |

## Despliegue

El servidor tiene un clon del repositorio y se despliega con un comando:

```bash
ssh bookingly
bookingly-deploy
```

Pull, dependencias, migraciones, build, reinicio y comprobación de salud, con vuelta atrás
automática si algo falla. Detalles completos en [DEPLOY.md](DEPLOY.md).

La ingesta corre sola cada 2 h con un temporizador de systemd. Para lanzarla a mano:
`bookingly-deploy --ingest`.

También existe el endpoint `/api/cron/ingest`, protegido con `Authorization: Bearer
$CRON_SECRET`, por si prefieres dispararla desde fuera.

## Panel

`/admin`, protegido por `ADMIN_PASSWORD` (cookie firmada con HMAC, 7 días).

- Cola de borradores, publicados y descartados, con nota de calidad y marca `auto`.
- Editor con vista previa, selector de sección, etiquetas y campos SEO.
- Gestión de fuentes: añadir, pausar, borrar.
- Botón de ingesta manual.

## Estructura

```
db/schema.sql              esquema (idempotente, se puede reejecutar)
scripts/                   migrate, seed, ingest, check-feed, selftest
src/lib/
  categories.ts            las 10 secciones fijas del medio
  dedupe.ts                detección de noticias repetidas
  deepseek.ts              cliente HTTP con reintentos
  rewriter.ts              ★ la voz editorial y el control de calidad
  ingest.ts                pipeline: feed → dedupe → extraer → reescribir → publicar
  repo.ts                  consultas SQL
src/app/                   portada, artículo, categoría, tema, feed, sitemap, panel
```

Para cambiar el tono del medio, toca solo `SYSTEM_PROMPT` en `src/lib/rewriter.ts`.

## Secciones

`ia`, `software`, `hardware`, `ciberseguridad`, `internet`, `ciencia`, `negocios`,
`politica`, `gaming`, `cultura`. Se editan en `src/lib/categories.ts`; el modelo elige una
por noticia y la navegación solo muestra las que ya tienen contenido.

## Nota legal

El sistema reescribe información de fuentes públicas y siempre enlaza y atribuye el original.
Eso es práctica periodística estándar, pero conviene tenerlo presente: no copia párrafos
literales, no republica contenido íntegro y el prompt prohíbe inventar datos o citas. Revisa
los términos de uso de los feeds que actives; algunos medios restringen el uso comercial de
sus contenidos.
