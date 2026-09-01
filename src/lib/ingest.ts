import Parser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import { query, queryOne } from "./db";
import { fingerprint, readingMinutes, slugify } from "./slug";
import { rewriteArticle } from "./rewriter";
import { DeepSeekError } from "./deepseek";
import { attachExtraSource, findDuplicate, titleKey } from "./dedupe";
import { env } from "./env";

export type Source = {
  id: number;
  name: string;
  feed_url: string;
  site_url: string | null;
  lang: string;
  active: boolean;
};

export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: Date | null;
  image: string | null;
};

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "user-agent": `${env.siteName}/1.0 (+${env.siteUrl}) feed reader`,
    accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
  },
  customFields: { item: [["media:content", "mediaContent", { keepArray: false }]] },
});

export async function listSources(onlyActive = true): Promise<Source[]> {
  return query<Source>(
    `SELECT id, name, feed_url, site_url, lang, active
       FROM sources
      ${onlyActive ? "WHERE active = TRUE" : ""}
      ORDER BY name ASC`
  );
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
        image: pickImage(item as unknown as Record<string, unknown>),
      } satisfies FeedItem;
    })
    .filter((i): i is FeedItem => Boolean(i && i.title));
}

/** Descarga el articulo completo; si falla, nos quedamos con el resumen del RSS. */
export async function fetchArticleText(
  item: FeedItem
): Promise<{ text: string; image: string | null }> {
  try {
    const article = await extract(item.link);
    const text = stripHtml(article?.content || "").trim();
    if (text.length > 400) {
      return { text, image: item.image || article?.image || null };
    }
  } catch {
    // Muchos medios bloquean bots; caemos al resumen sin dramatizar.
  }
  return { text: item.summary, image: item.image };
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
  onProgress?: (msg: string) => void;
};

export type IngestReport = {
  seen: number;
  created: number;
  published: number;
  duplicates: number;
  skipped: number;
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
  const report: IngestReport = {
    seen: 0,
    created: 0,
    published: 0,
    duplicates: 0,
    skipped: 0,
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
      items = await fetchFeed(source);
      log(`${source.name}: ${items.length} entradas en el feed`);
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
        const { text, image } = await fetchArticleText(item);
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
             (source_id, source_name, source_url, source_title, source_published_at,
              fingerprint, title_key, status, published_at, auto_published,
              title, slug, dek, body_md, tags, category,
              seo_title, seo_description, image_url, reading_minutes, model,
              quality_score, quality_notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
           ON CONFLICT (fingerprint) DO NOTHING`,
          [
            source.id,
            source.name,
            item.link,
            item.title,
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
        report.errors.join("\n").slice(0, 4000),
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
