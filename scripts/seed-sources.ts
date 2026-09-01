/**
 * Carga el set inicial de feeds de tecnologia. Idempotente: se puede reejecutar.
 *
 *   npm run db:seed             -> anade todas las fuentes
 *   npm run db:seed -- --check  -> ademas comprueba que cada feed responde
 */
import "dotenv/config";
import { addSource } from "../src/lib/repo";
import { closePool } from "../src/lib/db";
import { fetchFeed } from "../src/lib/ingest";

type Feed = { name: string; feed: string; site: string; lang: string };

/** Medios generalistas de tecnologia en ingles. */
const EN_GENERAL: Feed[] = [
  { name: "Ars Technica", feed: "https://feeds.arstechnica.com/arstechnica/index", site: "https://arstechnica.com", lang: "en" },
  { name: "The Verge", feed: "https://www.theverge.com/rss/index.xml", site: "https://www.theverge.com", lang: "en" },
  { name: "TechCrunch", feed: "https://techcrunch.com/feed/", site: "https://techcrunch.com", lang: "en" },
  { name: "Engadget", feed: "https://www.engadget.com/rss.xml", site: "https://www.engadget.com", lang: "en" },
  { name: "Wired", feed: "https://www.wired.com/feed/rss", site: "https://www.wired.com", lang: "en" },
  { name: "Gizmodo", feed: "https://gizmodo.com/rss", site: "https://gizmodo.com", lang: "en" },
  { name: "ZDNET", feed: "https://www.zdnet.com/news/rss.xml", site: "https://www.zdnet.com", lang: "en" },
  { name: "CNET", feed: "https://www.cnet.com/rss/news/", site: "https://www.cnet.com", lang: "en" },
  { name: "TechRadar", feed: "https://www.techradar.com/rss", site: "https://www.techradar.com", lang: "en" },
  { name: "Digital Trends", feed: "https://www.digitaltrends.com/feed/", site: "https://www.digitaltrends.com", lang: "en" },
  { name: "The Next Web", feed: "https://thenextweb.com/feed", site: "https://thenextweb.com", lang: "en" },
  { name: "VentureBeat", feed: "https://venturebeat.com/feed/", site: "https://venturebeat.com", lang: "en" },
  { name: "MIT Technology Review", feed: "https://www.technologyreview.com/feed/", site: "https://www.technologyreview.com", lang: "en" },
  { name: "IEEE Spectrum", feed: "https://spectrum.ieee.org/feeds/feed.rss", site: "https://spectrum.ieee.org", lang: "en" },
  { name: "Slashdot", feed: "https://rss.slashdot.org/Slashdot/slashdotMain", site: "https://slashdot.org", lang: "en" },
];

/** Comunidad y agregadores: buenos para detectar temas antes que los medios. */
const EN_COMMUNITY: Feed[] = [
  { name: "Hacker News (top)", feed: "https://hnrss.org/frontpage?points=250", site: "https://news.ycombinator.com", lang: "en" },
  { name: "Lobsters", feed: "https://lobste.rs/rss", site: "https://lobste.rs", lang: "en" },
];

/** Nichos: IA, seguridad, hardware, desarrollo, videojuegos. */
const EN_NICHE: Feed[] = [
  { name: "Ars Technica · IA", feed: "https://arstechnica.com/ai/feed/", site: "https://arstechnica.com/ai/", lang: "en" },
  { name: "Google DeepMind", feed: "https://deepmind.google/blog/rss.xml", site: "https://deepmind.google/discover/blog/", lang: "en" },
  { name: "OpenAI", feed: "https://openai.com/news/rss.xml", site: "https://openai.com/news/", lang: "en" },
  { name: "Hugging Face Blog", feed: "https://huggingface.co/blog/feed.xml", site: "https://huggingface.co/blog", lang: "en" },
  { name: "The Hacker News", feed: "https://feeds.feedburner.com/TheHackersNews", site: "https://thehackernews.com", lang: "en" },
  { name: "BleepingComputer", feed: "https://www.bleepingcomputer.com/feed/", site: "https://www.bleepingcomputer.com", lang: "en" },
  { name: "Krebs on Security", feed: "https://krebsonsecurity.com/feed/", site: "https://krebsonsecurity.com", lang: "en" },
  { name: "Schneier on Security", feed: "https://www.schneier.com/feed/atom/", site: "https://www.schneier.com", lang: "en" },
  { name: "AnandTech", feed: "https://www.anandtech.com/rss/", site: "https://www.anandtech.com", lang: "en" },
  { name: "Tom's Hardware", feed: "https://www.tomshardware.com/feeds/all", site: "https://www.tomshardware.com", lang: "en" },
  { name: "Phoronix", feed: "https://www.phoronix.com/rss.php", site: "https://www.phoronix.com", lang: "en" },
  { name: "9to5Mac", feed: "https://9to5mac.com/feed/", site: "https://9to5mac.com", lang: "en" },
  { name: "9to5Google", feed: "https://9to5google.com/feed/", site: "https://9to5google.com", lang: "en" },
  { name: "Android Police", feed: "https://www.androidpolice.com/feed/", site: "https://www.androidpolice.com", lang: "en" },
  { name: "GitHub Blog", feed: "https://github.blog/feed/", site: "https://github.blog", lang: "en" },
  { name: "Stack Overflow Blog", feed: "https://stackoverflow.blog/feed/", site: "https://stackoverflow.blog", lang: "en" },
  { name: "Eurogamer", feed: "https://www.eurogamer.net/feed", site: "https://www.eurogamer.net", lang: "en" },
  { name: "Polygon", feed: "https://www.polygon.com/rss/index.xml", site: "https://www.polygon.com", lang: "en" },
];

/** Medios en espanol: aportan contexto local y vocabulario natural. */
const ES: Feed[] = [
  { name: "Xataka", feed: "https://www.xataka.com/feedburner.xml", site: "https://www.xataka.com", lang: "es" },
  { name: "Genbeta", feed: "https://www.genbeta.com/feedburner.xml", site: "https://www.genbeta.com", lang: "es" },
  { name: "Xataka Movil", feed: "https://www.xatakamovil.com/feedburner.xml", site: "https://www.xatakamovil.com", lang: "es" },
  { name: "Hipertextual", feed: "https://hipertextual.com/feed", site: "https://hipertextual.com", lang: "es" },
  { name: "Applesfera", feed: "https://www.applesfera.com/feedburner.xml", site: "https://www.applesfera.com", lang: "es" },
  { name: "Muy Computer", feed: "https://www.muycomputer.com/feed/", site: "https://www.muycomputer.com", lang: "es" },
  { name: "MuySeguridad", feed: "https://www.muyseguridad.net/feed/", site: "https://www.muyseguridad.net", lang: "es" },
  { name: "El Diario · Tecnologia", feed: "https://www.eldiario.es/rss/tecnologia/", site: "https://www.eldiario.es/tecnologia/", lang: "es" },
  { name: "Xataka Android", feed: "https://www.xatakandroid.com/feedburner.xml", site: "https://www.xatakandroid.com", lang: "es" },
  { name: "Vida Extra", feed: "https://www.vidaextra.com/feedburner.xml", site: "https://www.vidaextra.com", lang: "es" },
];

const ALL = [...EN_GENERAL, ...EN_COMMUNITY, ...EN_NICHE, ...ES];
const check = process.argv.includes("--check");

for (const f of ALL) {
  await addSource(f.name, f.feed, f.site, f.lang);
  if (!check) {
    console.log(`ok    ${f.name}`);
    continue;
  }
  try {
    const items = await fetchFeed({
      id: 0,
      name: f.name,
      feed_url: f.feed,
      site_url: f.site,
      lang: f.lang,
      active: true,
    });
    console.log(`ok    ${f.name.padEnd(26)} ${items.length} entradas`);
  } catch (err) {
    console.log(`FALLA ${f.name.padEnd(26)} ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${ALL.length} fuentes cargadas.`);
if (!check) console.log("Ejecuta 'npm run db:seed -- --check' para verificar que todas responden.");
await closePool();
