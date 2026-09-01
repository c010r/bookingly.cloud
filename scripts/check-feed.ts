/**
 * Comprueba un feed sin tocar la base de datos ni gastar tokens de DeepSeek.
 *
 *   npx tsx scripts/check-feed.ts https://feeds.arstechnica.com/arstechnica/index
 */
import "dotenv/config";
import { fetchFeed, fetchArticleText } from "../src/lib/ingest";

const url = process.argv[2];
if (!url) {
  console.error("Uso: npx tsx scripts/check-feed.ts <url-del-feed>");
  process.exit(1);
}

const items = await fetchFeed({
  id: 0,
  name: "test",
  feed_url: url,
  site_url: null,
  lang: "en",
  active: true,
  kind: "rss",
});

console.log(`${items.length} entradas encontradas.\n`);
for (const item of items.slice(0, 3)) {
  const { text, image } = await fetchArticleText(item);
  console.log(`- ${item.title}`);
  console.log(`  ${item.link}`);
  console.log(`  fecha: ${item.publishedAt?.toISOString() ?? "sin fecha"}`);
  console.log(`  imagen: ${image ?? "ninguna"}`);
  console.log(`  texto extraido: ${text.length} caracteres`);
  console.log(`  inicio: ${text.slice(0, 160)}...\n`);
}
