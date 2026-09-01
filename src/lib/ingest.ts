import Parser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import { query, queryOne } from "./db";
import { fingerprint, readingMinutes, slugify } from "./slug";
import { rewriteArticle } from "./rewriter";
import { DeepSeekError } from "./deepseek";
import { attachExtraSource, findDuplicate, titleKey } from "./dedupe";
import { env } from "./env";
import { readme, repoContent, trendingRepos } from "./collectors/github";
import { digestContent, lanzamientos } from "./collectors/producthunt";

export type Source = {
  id: number;
  name: string;
  feed_url: string;
  site_url: string | null;
  lang: string;
  active: boolean;
  /** "rss" para feeds; "github" se consulta por API. */
  kind: string;
};

export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: Date | null;
  image: string | null;
  /** Quien firma el original, si el feed lo dice. */
  author: string | null;
  /** Si viene ya resuelto, no hace falta descargar y extraer la pagina. */
  content?: string;
};

const parser = new Parser({
  timeout: 20_000,
  headers: {
    // Varios medios (Digital Trends entre ellos) devuelven una pagina de
    // bloqueo a los user-agent que no parecen un navegador.
    "user-agent":
      "Mozilla/5.0 (compatible; c010rNewsBot/1.0; +https://bookingly.cloud)",
    accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
  },
  customFields: { item: [["media:content", "mediaContent", { keepArray: false }]] },
});

export async function listSources(onlyActive = true): Promise<Source[]> {
  return query<Source>(
    `SELECT id, name, feed_url, site_url, lang, active, kind
       FROM sources
      ${onlyActive ? "WHERE active = TRUE" : ""}
      ORDER BY name ASC`
  );
}

/** Obtiene las entradas de una fuente, sea del tipo que sea. */
export async function collectItems(source: Source): Promise<FeedItem[]> {
  if (source.kind === "github") return githubItems();
  if (source.kind === "producthunt") return productHuntItems();
  return fetchFeed(source);
}

/** Repositorios que estan explotando en estrellas, como si fueran noticias. */
async function githubItems(): Promise<FeedItem[]> {
  const repos = await trendingRepos({ limite: 8 });
  const items: FeedItem[] = [];
  for (const repo of repos) {
    const texto = await readme(repo.fullName);
    items.push({
      title: `${repo.fullName}: ${repo.stars.toLocaleString("es-ES")} estrellas en GitHub`,
      link: repo.url,
      summary: repo.description,
      // Lo noticiable es que esta despegando ahora, no cuando se creo el
      // repositorio: esa fecha ya va dentro del texto.
      publishedAt: new Date(),
      author: repo.owner,
      image: `https://opengraph.githubassets.com/1/${repo.fullName}`,
      content: repoContent(repo, texto),
    });
  }
  return items;
}

/**
 * Un unico resumen diario con los lanzamientos destacados. Una pieza por
 * producto seria imposible: la API da un lema y poco mas de cada uno.
 */
async function productHuntItems(): Promise<FeedItem[]> {
  // Sin token no hay nada que hacer, pero tampoco es un error: la fuente se
  // salta y el resto de la ingesta sigue igual.
  if (!env.tieneProductHunt) {
    console.warn(
      "Product Hunt: sin credenciales (PRODUCTHUNT_CLIENT_ID y " +
        "PRODUCTHUNT_CLIENT_SECRET, o PRODUCTHUNT_TOKEN). Se salta la fuente."
    );
    return [];
  }

  const productos = await lanzamientos(24);
  if (productos.length < 3) return [];

  const hoy = new Date();
  const dia = hoy.toISOString().slice(0, 10);
  const nombres = productos.slice(0, 3).map((p) => p.name).join(", ");

  return [
    {
      // El enlace lleva la fecha para que cada dia sea un articulo distinto:
      // es la clave con la que se detecta lo ya publicado.
      link: `https://www.producthunt.com/leaderboard/daily/${dia}`,
      title: `Lanzamientos del dia en Product Hunt: ${nombres} y mas`,
      summary: `Los ${productos.length} productos mas votados del dia.`,
      publishedAt: hoy,
      author: null,
      image: null,
      content: digestContent(productos),
    },
  ];
}

export async function fetchFeed(source: Source): Promise<FeedItem[]> {
  const feed = await parser.parseURL(source.feed_url);
  return (feed.items || [])
    .map((item) => {
      const link = (item.link || item.guid || "").trim();
      if (!link || !/^https?:\/\//i.test(link)) return null;
      const dateStr = item.isoDate || item.pubDate;
      const date = dateStr ? new Date(dateStr) : null;
      return {
        title: (item.title || "").trim(),
        link,
        summary: stripHtml(item.contentSnippet || item.content || ""),
        publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
        author: pickAuthor(item as unknown as Record<string, unknown>),
        image: pickImage(item as unknown as Record<string, unknown>),
      } satisfies FeedItem;
    })
    .filter((i): i is FeedItem => Boolean(i && i.title));
}

/** Descarga el articulo completo; si falla, nos quedamos con el resumen del RSS. */
export async function fetchArticleText(
  item: FeedItem
): Promise<{ text: string; image: string | null; author: string | null }> {
  // Las fuentes de API ya entregan su propio material.
  if (item.content) return { text: item.content, image: item.image, author: item.author };

  try {
    const article = await extract(item.link);
    const text = stripHtml(article?.content || "").trim();
    // Muchos feeds no traen dc:creator pero la pagina si lleva firma.
    const author = item.author ?? limpiarAutor(article?.author);
    if (text.length > 400) {
      return { text, image: item.image || article?.image || null, author };
    }
    return { text: item.summary, image: item.image, author };
  } catch {
    // Muchos medios bloquean bots; caemos al resumen sin dramatizar.
  }
  return { text: item.summary, image: item.image, author: item.author };
}

export type IngestOptions = {
  maxPerRun?: number;
  sourceId?: number;
  /** No llama a DeepSeek, solo reporta que se ingeriria. */
  dryRun?: boolean;
  /** Fuerza el modo de publicacion, ignorando la configuracion del entorno. */
  autoPublish?: boolean;
  /** Articulos nuevos como maximo por fuente y tanda. */
  maxPerSource?: number;
  /** Antiguedad maxima admitida, en horas. */
  maxAgeHours?: number;
  onProgress?: (msg: string) => void;
};

export type IngestReport = {
  seen: number;
  created: number;
  published: number;
  duplicates: number;
  skipped: number;
  /** Descartadas por ser mas viejas que la ventana de frescura. */
  stale: number;
  failed: number;
  errors: string[];
};

export async function runIngest(opts: IngestOptions = {}): Promise<IngestReport> {
  const max = opts.maxPerRun ?? env.maxPerRun;
  // Sin cupo por fuente, la primera del listado llena ella sola toda la tanda
  // y el resto no llega a mirarse nunca: la portada acaba siendo un solo medio.
  const perSource = opts.maxPerSource ?? env.maxPerSource ?? Math.max(2, Math.ceil(max / 4));
  const autoPublish = opts.autoPublish ?? env.autoPublish;
  const minScore = env.autoPublishMinScore;
  const log = opts.onProgress ?? (() => {});
  const horasMax = opts.maxAgeHours ?? env.maxAgeHours;
  const limiteFrescura = Date.now() - horasMax * 3_600_000;
  const report: IngestReport = {
    seen: 0,
    created: 0,
    published: 0,
    duplicates: 0,
    skipped: 0,
    stale: 0,
    failed: 0,
    errors: [],
  };

  const run = await queryOne<{ id: number }>(`INSERT INTO ingest_runs DEFAULT VALUES RETURNING id`);

  let sources = await listSources();
  if (opts.sourceId) sources = sources.filter((s) => s.id === opts.sourceId);
  // Y en orden aleatorio, para que no sean siempre las mismas las que se
  // quedan sin cupo cuando la tanda se llena antes de recorrerlas todas.
  else sources = shuffle(sources);

  outer: for (const source of sources) {
    let fromThisSource = 0;
    let items: FeedItem[] = [];
    try {
      items = await collectItems(source);
      log(`${source.name}: ${items.length} entradas`);
    } catch (err) {
      report.failed++;
      const msg = `Feed ${source.name}: ${errMsg(err)}`;
      report.errors.push(msg);
      log(msg);
      continue;
    }

    for (const item of items) {
      if (report.created >= max) break outer;
      if (fromThisSource >= perSource) break; // cupo lleno: pasamos de fuente
      report.seen++;

      // Solo noticias frescas: un feed puede arrastrar entradas de hace
      // semanas y no queremos publicarlas como novedad.
      if (item.publishedAt && item.publishedAt.getTime() < limiteFrescura) {
        report.stale++;
        continue;
      }

      // Nivel 1 de deduplicacion: exactamente la misma URL.
      const fp = fingerprint(item.link);
      const exists = await queryOne<{ id: number }>(
        `SELECT id FROM articles WHERE fingerprint = $1`,
        [fp]
      );
      if (exists) {
        report.skipped++;
        continue;
      }

      // Nivel 2: la misma noticia contada por otro medio.
      const dup = await findDuplicate(item.title, item.title);
      if (dup) {
        await attachExtraSource(dup.id, {
          name: source.name,
          url: item.link,
          title: item.title,
        });
        report.duplicates++;
        log(
          `Repetida (${(dup.score * 100).toFixed(0)}% con "${dup.title}"): se anade ${source.name} como fuente adicional`
        );
        continue;
      }

      if (opts.dryRun) {
        log(`[dry-run] Se reescribiria: ${item.title}`);
        report.created++;
        fromThisSource++;
        continue;
      }

      try {
        const { text, image, author } = await fetchArticleText(item);
        if (text.trim().length < 200) {
          report.skipped++;
          log(`Sin texto suficiente, se salta: ${item.title}`);
          continue;
        }

        const rewritten = await rewriteArticle({
          sourceTitle: item.title,
          sourceUrl: item.link,
          sourceName: source.name,
          content: text,
          publishedAt: item.publishedAt,
        });

        // Segunda pasada de deduplicacion: el titular reescrito puede revelar
        // que es la misma noticia aunque el original sonara distinto.
        const dupAfter = await findDuplicate(rewritten.title, item.title);
        if (dupAfter) {
          await attachExtraSource(dupAfter.id, {
            name: source.name,
            url: item.link,
            title: item.title,
          });
          report.duplicates++;
          log(`Repetida tras reescribir: ${rewritten.title} -> ${dupAfter.title}`);
          continue;
        }

        // El sistema decide: publica solo lo que pasa el corte de calidad.
        const publish = autoPublish && rewritten.qualityScore >= minScore;
        const status = publish ? "published" : "draft";
        const slug = await uniqueSlug(
          slugify(rewritten.title) || slugify(item.title) || fp.slice(0, 12)
        );

        await query(
          `INSERT INTO articles
             (source_id, source_name, source_url, source_title, source_author, source_published_at,
              fingerprint, title_key, status, published_at, auto_published,
              title, slug, dek, body_md, tags, category,
              seo_title, seo_description, image_url, reading_minutes, model,
              quality_score, quality_notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           ON CONFLICT (fingerprint) DO NOTHING`,
          [
            source.id,
            source.name,
            item.link,
            item.title,
            author ?? null,
            item.publishedAt,
            fp,
            titleKey(item.title),
            status,
            publish ? new Date() : null,
            publish,
            rewritten.title,
            slug,
            rewritten.dek,
            rewritten.bodyMd,
            rewritten.tags,
            rewritten.category,
            rewritten.seoTitle,
            rewritten.seoDescription,
            image,
            readingMinutes(rewritten.bodyMd),
            rewritten.model,
            rewritten.qualityScore,
            rewritten.qualityNotes,
          ]
        );

        report.created++;
        fromThisSource++;
        if (publish) report.published++;
        log(
          `${publish ? "PUBLICADO" : "borrador"} [${rewritten.category}] ${rewritten.qualityScore}/100 — ${rewritten.title}`
        );
      } catch (err) {
        report.failed++;
        const msg = `${item.title}: ${errMsg(err)}`;
        report.errors.push(msg);
        log(msg);

        // Con la clave mal no hay nada que hacer: seguir recorriendo 45 feeds
        // solo quema tiempo y acaba matando el servicio por timeout.
        if (isAuthError(err)) {
          const fatal =
            "Credenciales de DeepSeek invalidas o sin saldo: se aborta la ingesta. " +
            "Revisa DEEPSEEK_API_KEY en el .env.";
          report.errors.push(fatal);
          log(fatal);
          break outer;
        }
      }
    }
  }

  if (run) {
    await query(
      `UPDATE ingest_runs
          SET finished_at = now(), seen = $2, created = $3, skipped = $4,
              failed = $5, duplicates = $6, published = $7, detail = $8
        WHERE id = $1`,
      [
        run.id,
        report.seen,
        report.created,
        report.skipped,
        report.failed,
        report.duplicates,
        report.published,
        [report.stale ? `Descartadas por antiguedad: ${report.stale}` : "", ...report.errors]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000),
      ]
    );
  }

  return report;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || "noticia";
  for (let i = 0; i < 20; i++) {
    const clash = await queryOne(`SELECT 1 FROM articles WHERE slug = $1`, [candidate]);
    if (!clash) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** dc:creator es lo habitual; algunos feeds usan author o un objeto anidado. */
function pickAuthor(item: Record<string, unknown>): string | null {
  const bruto =
    item.creator ??
    item["dc:creator"] ??
    item.author ??
    (item.author as { name?: string } | undefined)?.name;

  return limpiarAutor(bruto);
}

/** Normaliza una firma y descarta las que no identifican a nadie. */
export function limpiarAutor(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;

  const limpio = bruto
    .replace(/<[^>]+>/g, " ")
    // Muchos feeds firman "correo@dominio (Nombre Apellido)".
    .replace(/^\S+@\S+\s*\((.+)\)$/, "$1")
    .replace(/\s+/g, " ")
    .trim();

  // Firmas genericas que no aportan nada al lector.
  if (!limpio || /^(admin|editor|staff|redaccion|news ?desk)$/i.test(limpio)) return null;
  return limpio.slice(0, 120);
}

function pickImage(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && (!enclosure.type || enclosure.type.startsWith("image/"))) {
    return enclosure.url;
  }
  const media = (item.mediaContent ?? item["media:content"]) as
    | { $?: { url?: string }; url?: string }
    | undefined;
  if (media?.$?.url) return media.$.url;
  if (media?.url) return media.url;
  const content = String(item["content:encoded"] || item.content || "");
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/** 401/403 de DeepSeek: clave invalida, revocada o cuenta sin saldo. */
function isAuthError(err: unknown): boolean {
  return err instanceof DeepSeekError && (err.status === 401 || err.status === 403);
}

/** Fisher-Yates. */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
