import { query, queryOne } from "./db";
import type { ExtraSource } from "./dedupe";
import { titleKey } from "./dedupe";

export type Article = {
  id: number;
  source_id: number | null;
  source_name: string;
  source_url: string;
  source_title: string;
  source_author: string | null;
  source_published_at: Date | null;
  status: "draft" | "published" | "rejected";
  title: string;
  slug: string;
  dek: string | null;
  body_md: string;
  tags: string[];
  category: string;
  extra_sources: ExtraSource[];
  quality_score: number | null;
  quality_notes: string | null;
  auto_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  image_url: string | null;
  reading_minutes: number;
  views: number;
  model: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
};

const COLUMNS = `id, source_id, source_name, source_url, source_title, source_author, source_published_at,
  status, title, slug, dek, body_md, tags, category, extra_sources, quality_score,
  quality_notes, auto_published, seo_title, seo_description, image_url,
  reading_minutes, views, model, created_at, updated_at, published_at`;

export async function getPublished(limit = 20, offset = 0): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

export async function countPublished(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM articles WHERE status = 'published'`
  );
  return Number(row?.n ?? 0);
}

/** Las mas leidas de los ultimos dias, para el hero. */
export async function getMostRead(limit = 5, days = 7): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published'
        AND published_at > now() - ($2 || ' days')::interval
      ORDER BY views DESC, published_at DESC
      LIMIT $1`,
    [limit, String(days)]
  );
}

/** Ultimas en entrar o en editarse, para la columna de actualidad. */
export async function getRecentlyUpdated(limit = 5): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published'
      ORDER BY GREATEST(published_at, updated_at) DESC
      LIMIT $1`,
    [limit]
  );
}

/** Momento de la ultima publicacion, para el sello de actualizacion. */
export async function getLastUpdate(): Promise<Date | null> {
  const row = await queryOne<{ ultima: Date | null }>(
    `SELECT max(published_at) AS ultima FROM articles WHERE status = 'published'`
  );
  return row?.ultima ?? null;
}

export async function registerView(slug: string): Promise<void> {
  await query(
    `UPDATE articles SET views = views + 1 WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
}

export async function getBySlug(slug: string): Promise<Article | null> {
  return queryOne<Article>(
    `SELECT ${COLUMNS} FROM articles WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
}

/** Búsqueda rápida por titular, entradilla o categoría para el Command Menu (⌘K). */
export async function searchPublished(q: string, limit = 8): Promise<Article[]> {
  const patron = `%${q.trim()}%`;
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published'
        AND (title ILIKE $1 OR COALESCE(dek, '') ILIKE $1 OR category ILIKE $1)
      ORDER BY published_at DESC
      LIMIT $2`,
    [patron, limit]
  );
}

export async function getById(id: number): Promise<Article | null> {
  return queryOne<Article>(`SELECT ${COLUMNS} FROM articles WHERE id = $1`, [id]);
}

export async function getByCategory(category: string, limit = 40): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published' AND category = $1
      ORDER BY published_at DESC
      LIMIT $2`,
    [category, limit]
  );
}

export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = await query<{ category: string; n: string }>(
    `SELECT category, count(*)::text AS n
       FROM articles WHERE status = 'published'
      GROUP BY category`
  );
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.n)]));
}

export async function getRelated(article: Article, limit = 3): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = 'published' AND id <> $1
        AND (tags && $2 OR category = $3)
      ORDER BY (tags && $2) DESC, published_at DESC
      LIMIT $4`,
    [article.id, article.tags, article.category, limit]
  );
}

/* ---------- Panel ---------- */

export async function getByStatus(status: Article["status"], limit = 50): Promise<Article[]> {
  return query<Article>(
    `SELECT ${COLUMNS} FROM articles
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [status, limit]
  );
}

export async function statusCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: string }>(
    `SELECT status, count(*)::text AS n FROM articles GROUP BY status`
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

export async function updateArticle(
  id: number,
  patch: {
    title: string;
    dek: string;
    body_md: string;
    tags: string[];
    category: string;
    seo_title: string;
    seo_description: string;
    image_url: string | null;
  }
): Promise<void> {
  await query(
    `UPDATE articles
        SET title = $2, dek = $3, body_md = $4, tags = $5, category = $6,
            seo_title = $7, seo_description = $8, image_url = $9,
            title_key = $10,
            reading_minutes = GREATEST(1, round(array_length(regexp_split_to_array(trim($4), '\\s+'), 1) / 200.0)::int),
            updated_at = now()
      WHERE id = $1`,
    [
      id,
      patch.title,
      patch.dek,
      patch.body_md,
      patch.tags,
      patch.category,
      patch.seo_title,
      patch.seo_description,
      patch.image_url,
      titleKey(patch.title),
    ]
  );
}

export async function setStatus(id: number, status: Article["status"]): Promise<void> {
  await query(
    `UPDATE articles
        SET status = $2,
            published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
            updated_at = now()
      WHERE id = $1`,
    [id, status]
  );
}

export async function deleteArticle(id: number): Promise<void> {
  await query(`DELETE FROM articles WHERE id = $1`, [id]);
}

/* ---------- Fuentes ---------- */

export type SourceRow = {
  id: number;
  name: string;
  feed_url: string;
  site_url: string | null;
  lang: string;
  active: boolean;
  article_count: number;
};

export async function listSourcesWithCounts(): Promise<SourceRow[]> {
  const rows = await query<Omit<SourceRow, "article_count"> & { article_count: string }>(
    `SELECT s.id, s.name, s.feed_url, s.site_url, s.lang, s.active,
            count(a.id)::text AS article_count
       FROM sources s
       LEFT JOIN articles a ON a.source_id = s.id
      GROUP BY s.id
      ORDER BY s.active DESC, s.name ASC`
  );
  return rows.map((r) => ({ ...r, article_count: Number(r.article_count) }));
}

export async function addSource(
  name: string,
  feedUrl: string,
  siteUrl: string,
  lang: string,
  kind = "rss"
): Promise<void> {
  await query(
    `INSERT INTO sources (name, feed_url, site_url, lang, kind)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (feed_url) DO UPDATE
       SET name = EXCLUDED.name, kind = EXCLUDED.kind`,
    [name, feedUrl, siteUrl || null, lang || "en", kind]
  );
}

export async function toggleSource(id: number): Promise<void> {
  await query(`UPDATE sources SET active = NOT active WHERE id = $1`, [id]);
}

export async function removeSource(id: number): Promise<void> {
  await query(`DELETE FROM sources WHERE id = $1`, [id]);
}

export async function lastRuns(limit = 5) {
  return query<{
    id: number;
    started_at: Date;
    finished_at: Date | null;
    seen: number;
    created: number;
    published: number;
    duplicates: number;
    skipped: number;
    failed: number;
  }>(
    `SELECT id, started_at, finished_at, seen, created, published, duplicates, skipped, failed
       FROM ingest_runs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
}
