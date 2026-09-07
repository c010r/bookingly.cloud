/**
 * Crea una unica nota publicada a partir de un item concreto de un feed,
 * sin pasar por la ingesta completa (que recorre todas las fuentes). Sirve
 * para sacar una noticia puntual sin gastar tokens probando feeds enteros.
 *
 *   npx tsx scripts/nota-puntual.ts --source=1536 --match="claude's new system prompt"
 */
import "dotenv/config";
import { query, queryOne, closePool } from "../src/lib/db";
import { listSources, fetchFeed, fetchArticleText } from "../src/lib/ingest";
import { rewriteArticle } from "../src/lib/rewriter";
import { slugify, fingerprint, readingMinutes } from "../src/lib/slug";
import { titleKey } from "../src/lib/dedupe";
import { env } from "../src/lib/env";

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const sourceId = Number(flag("source"));
const match = (flag("match") ?? "").toLowerCase();
if (!sourceId || !match) {
  console.error("Uso: nota-puntual.ts --source=<id> --match=<substring del titular>");
  process.exit(1);
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

const sources = await listSources();
const source = sources.find((s) => s.id === sourceId);
if (!source) {
  console.error(`No existe la fuente ${sourceId}`);
  process.exit(1);
}

const items = await fetchFeed(source);
const item = items.find((i) => i.title.toLowerCase().includes(match));
if (!item) {
  console.error(`Ningun item de "${source.name}" contiene "${match}". Los hay:`);
  for (const i of items.slice(0, 12)) console.log(`  - ${i.title}`);
  process.exit(1);
}
console.log(`Item elegido: ${item.title}`);

const { text, image, author, links } = await fetchArticleText(item);
if (text.trim().length < 200) throw new Error("sin texto suficiente");
const rewritten = await rewriteArticle({
  sourceTitle: item.title,
  sourceUrl: item.link,
  sourceName: source.name,
  content: text,
  publishedAt: item.publishedAt,
  enlaces: links.slice(0, 6),
});

const slug = await uniqueSlug(slugify(rewritten.title) || slugify(item.title) || fingerprint(item.link).slice(0, 12));
await query(
  `INSERT INTO articles
     (source_id, source_name, source_url, source_title, source_author, source_published_at,
      fingerprint, title_key, status, published_at, auto_published,
      title, slug, dek, body_md, tags, category,
      seo_title, seo_description, image_url, reading_minutes, model,
      quality_score, quality_notes, links)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
  [
    source.id,
    source.name,
    item.link,
    item.title,
    null,
    item.publishedAt,
    fingerprint(item.link),
    titleKey(item.title),
    "published",
    new Date(),
    true,
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
    JSON.stringify(rewritten.enlaces),
  ]
);
console.log(`Proveedor: ${env.llmBaseUrl} ${env.llmModel}`);
console.log(`PUBLICADA #? [${rewritten.category}] ${rewritten.qualityScore}/100 (${rewritten.model})`);
console.log(`  ${rewritten.title}`);
console.log(`  https://bookingly.cloud/noticia/${slug}`);

await closePool();
