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

type Feed = { name: string; feed: string; site: string; lang: string; kind?: string };

/** Medios generalistas de tecnologia en ingles. */
const EN_GENERAL: Feed[] = [
  { name: "Ars Technica", feed: "https://feeds.arstechnica.com/arstechnica/index", site: "https://arstechnica.com", lang: "en" },
  { name: "The Verge", feed: "https://www.theverge.com/rss/index.xml", site: "https://www.theverge.com", lang: "en" },
  { name: "TechCrunch", feed: "https://techcrunch.com/feed/", site: "https://techcrunch.com", lang: "en" },
  { name: "Engadget", feed: "https://www.engadget.com/rss.xml", site: "https://www.engadget.com", lang: "en" },
  { name: "Wired", feed: "https://www.wired.com/feed/rss", site: "https://www.wired.com", lang: "en" },
  { name: "Gizmodo", feed: "https://gizmodo.com/rss", site: "https://gizmodo.com", lang: "en" },
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
  { name: "Tom's Hardware", feed: "https://www.tomshardware.com/feeds/all", site: "https://www.tomshardware.com", lang: "en" },
  { name: "TechSpot", feed: "https://www.techspot.com/backend.xml", site: "https://www.techspot.com", lang: "en" },
  { name: "HotHardware", feed: "https://hothardware.com/rss/news", site: "https://hothardware.com", lang: "en" },
  { name: "ServeTheHome", feed: "https://www.servethehome.com/feed/", site: "https://www.servethehome.com", lang: "en" },
  { name: "Phoronix", feed: "https://www.phoronix.com/rss.php", site: "https://www.phoronix.com", lang: "en" },
  { name: "9to5Mac", feed: "https://9to5mac.com/feed/", site: "https://9to5mac.com", lang: "en" },
  { name: "9to5Google", feed: "https://9to5google.com/feed/", site: "https://9to5google.com", lang: "en" },
  { name: "Android Police", feed: "https://www.androidpolice.com/feed/", site: "https://www.androidpolice.com", lang: "en" },
  { name: "GitHub Blog", feed: "https://github.blog/feed/", site: "https://github.blog", lang: "en" },
  { name: "Stack Overflow Blog", feed: "https://stackoverflow.blog/feed/", site: "https://stackoverflow.blog", lang: "en" },
  { name: "Eurogamer", feed: "https://www.eurogamer.net/feed", site: "https://www.eurogamer.net", lang: "en" },
  { name: "Polygon", feed: "https://www.polygon.com/rss/index.xml", site: "https://www.polygon.com", lang: "en" },
];

/** IA: el tema con mas volumen de noticias, con seccion propia en el sitio. */
const IA: Feed[] = [
  { name: "TechCrunch · IA", feed: "https://techcrunch.com/category/artificial-intelligence/feed/", site: "https://techcrunch.com/category/artificial-intelligence/", lang: "en" },
  { name: "The Verge · IA", feed: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", site: "https://www.theverge.com/ai-artificial-intelligence", lang: "en" },
  { name: "VentureBeat · IA", feed: "https://venturebeat.com/category/ai/feed/", site: "https://venturebeat.com/category/ai/", lang: "en" },
  { name: "MIT Tech Review · IA", feed: "https://www.technologyreview.com/topic/artificial-intelligence/feed", site: "https://www.technologyreview.com/topic/artificial-intelligence/", lang: "en" },
  { name: "The Decoder", feed: "https://the-decoder.com/feed/", site: "https://the-decoder.com", lang: "en" },
  { name: "MarkTechPost", feed: "https://www.marktechpost.com/feed/", site: "https://www.marktechpost.com", lang: "en" },
  { name: "Google · Blog de IA", feed: "https://blog.google/technology/ai/rss/", site: "https://blog.google/technology/ai/", lang: "en" },
  { name: "NVIDIA Blog", feed: "https://blogs.nvidia.com/feed/", site: "https://blogs.nvidia.com", lang: "en" },
  { name: "Import AI", feed: "https://importai.substack.com/feed", site: "https://importai.substack.com", lang: "en" },
];

/** Descubrimiento: producto nuevo y proyectos que despegan. */
const DESCUBRIMIENTO: Feed[] = [
  // No es un feed: se consulta la API de busqueda de GitHub. La URL queda
  // como identificador, porque feed_url es la clave unica de la tabla.
  { name: "GitHub en alza", feed: "https://github.com/trending", site: "https://github.com", lang: "en", kind: "github" },

  // Alternativas comprobadas a Product Hunt. Se filtran por puntos o por
  // popularidad porque sin filtro el texto de cada entrada es demasiado
  // pobre para escribir nada: lo que sobra son lanzamientos, lo que falta
  // es material.
  { name: "Show HN", feed: "https://hnrss.org/show?points=20", site: "https://news.ycombinator.com/show", lang: "en" },
  { name: "Launch HN", feed: "https://hnrss.org/newest?q=Launch+HN", site: "https://news.ycombinator.com", lang: "en" },
  { name: "AlternativeTo", feed: "https://alternativeto.net/news/feed/", site: "https://alternativeto.net", lang: "en" },
  // Sustituye a Product Hunt, que exigia credenciales de API y nunca trajo
  // nada. Sale del catalogo de launchdirectories.com y es la unica alternativa
  // de las 19 que alli figuran con un feed util: medido desde el lector de la
  // aplicacion, 25 entradas y un parrafo real por producto (media de 494
  // caracteres, minimo 251), frente al eslogan de una linea de Product Hunt.
  { name: "BetaList", feed: "https://feeds.feedburner.com/BetaList", site: "https://betalist.com", lang: "en" },

  // Publicaciones para profesionales de TI: infraestructura, kernel,
  // arquitectura y herramientas. Es el material que le sirve a quien despliega
  // y mantiene, no a quien compara dos moviles antes de comprar.
  { name: "The New Stack", feed: "https://thenewstack.io/feed/", site: "https://thenewstack.io", lang: "en" },
  { name: "LWN", feed: "https://lwn.net/headlines/rss", site: "https://lwn.net", lang: "en" },
  { name: "InfoQ", feed: "https://feed.infoq.com/", site: "https://www.infoq.com", lang: "en" },
  { name: "Changelog", feed: "https://changelog.com/feed", site: "https://changelog.com", lang: "en" },
  { name: "Console.dev", feed: "https://console.dev/rss.xml", site: "https://console.dev", lang: "en" },
  { name: "KDnuggets", feed: "https://www.kdnuggets.com/feed", site: "https://www.kdnuggets.com", lang: "en" },
  { name: "The Register", feed: "https://www.theregister.com/headlines.atom", site: "https://www.theregister.com", lang: "en" },
  { name: "Red Hat Enable Sysadmin", feed: "https://www.redhat.com/sysadmin/rss.xml", site: "https://www.redhat.com/sysadmin", lang: "en" },
  { name: "Dev.to", feed: "https://dev.to/feed", site: "https://dev.to", lang: "en" },

  // Reddit limita por frecuencia, no bloquea: midiendo desde el servidor
  // responde una de cada tres o cuatro veces, incluso espaciando 20 s. Se
  // dejan puestas porque cuando contestan traen material que no da ningun
  // medio, y un feed que falla solo se anota en el log y no rompe la tanda.
  // Ojo: son comunidades de preguntas y quejas mas que de noticias, asi que
  // el filtro editorial va a descartar buena parte de lo que traigan.
  { name: "r/sysadmin", feed: "https://www.reddit.com/r/sysadmin/.rss", site: "https://www.reddit.com/r/sysadmin/", lang: "en" },
  { name: "r/networking", feed: "https://www.reddit.com/r/networking/.rss", site: "https://www.reddit.com/r/networking/", lang: "en" },
  { name: "r/devops", feed: "https://www.reddit.com/r/devops/.rss", site: "https://www.reddit.com/r/devops/", lang: "en" },
  { name: "r/selfhosted", feed: "https://www.reddit.com/r/selfhosted/.rss", site: "https://www.reddit.com/r/selfhosted/", lang: "en" },

  // ZDNET publica por tema en /rss/<tema>/, en Atom. Se cogen las cuatro que
  // encajan y no la portada general, que arrastra bastante consumo.
  { name: "ZDNET · Linux", feed: "https://www.zdnet.com/rss/linux/", site: "https://www.zdnet.com", lang: "en" },
  { name: "ZDNET · Open source", feed: "https://www.zdnet.com/rss/open-source/", site: "https://www.zdnet.com", lang: "en" },
  { name: "ZDNET · IA", feed: "https://www.zdnet.com/rss/artificial-intelligence/", site: "https://www.zdnet.com", lang: "en" },
  { name: "ZDNET · Seguridad", feed: "https://www.zdnet.com/rss/security/", site: "https://www.zdnet.com", lang: "en" },

  // Tecnologia asiatica: cubre fabricantes, chips y companias chinas que los
  // medios occidentales dan tarde o no dan. ITHome publica en chino; el
  // redactor traduce, pero ojo, el detector de repetidas compara titulares y
  // uno en chino no se parece a uno en ingles, asi que un duplicado suyo solo
  // se caza despues de reescribirlo, gastando cupo. TechNode sirve su archivo
  // entero en cada peticion, unas 2000 entradas: la comprobacion de antiguedad
  // las descarta en memoria antes de tocar la base, pero deja el contador de
  // caducadas muy ruidoso.
  { name: "ITHome", feed: "https://www.ithome.com/rss", site: "https://www.ithome.com", lang: "zh" },
  { name: "Pandaily", feed: "https://pandaily.com/feed/", site: "https://pandaily.com", lang: "en" },
  { name: "TechNode", feed: "https://technode.com/feed/", site: "https://technode.com", lang: "en" },
];

// Descartadas tras probarlas desde el servidor: Server Fault (403), KrASIA
// (su XML esta mal formado y rompe el analizador con "Invalid character in
// entity name") y el RSS crudo de Hacker News,
// que traeria la portada entera sin filtrar; ya esta hnrss con umbral de 250
// puntos, que es la misma fuente pero quedandose solo con lo que destaca.

/** Medios en espanol: aportan contexto local y vocabulario natural. */
const ES: Feed[] = [
  { name: "Xataka", feed: "https://www.xataka.com/feedburner.xml", site: "https://www.xataka.com", lang: "es" },
  { name: "Genbeta", feed: "https://www.genbeta.com/feedburner.xml", site: "https://www.genbeta.com", lang: "es" },
  { name: "Xataka Movil", feed: "https://www.xatakamovil.com/feedburner.xml", site: "https://www.xatakamovil.com", lang: "es" },
  { name: "Hipertextual", feed: "https://hipertextual.com/feed", site: "https://hipertextual.com", lang: "es" },
  { name: "Applesfera", feed: "https://www.applesfera.com/feedburner.xml", site: "https://www.applesfera.com", lang: "es" },
  { name: "El Diario · Tecnologia", feed: "https://www.eldiario.es/rss/tecnologia/", site: "https://www.eldiario.es/tecnologia/", lang: "es" },
  { name: "Xataka Android", feed: "https://www.xatakandroid.com/feedburner.xml", site: "https://www.xatakandroid.com", lang: "es" },
  { name: "ADSLZone", feed: "https://www.adslzone.net/feed/", site: "https://www.adslzone.net", lang: "es" },
  { name: "Computer Hoy", feed: "https://computerhoy.20minutos.es/rss", site: "https://computerhoy.20minutos.es", lang: "es" },
  { name: "Omicrono", feed: "https://www.elespanol.com/rss/omicrono/", site: "https://www.elespanol.com/omicrono/", lang: "es" },
  { name: "Vida Extra", feed: "https://www.vidaextra.com/feedburner.xml", site: "https://www.vidaextra.com", lang: "es" },
];

const ALL = [...EN_GENERAL, ...EN_COMMUNITY, ...EN_NICHE, ...IA, ...DESCUBRIMIENTO, ...ES];
const check = process.argv.includes("--check");

for (const f of ALL) {
  await addSource(f.name, f.feed, f.site, f.lang, f.kind ?? "rss");
  if (!check) {
    console.log(`ok    ${f.name}`);
    continue;
  }
  if (f.kind && f.kind !== "rss") {
    console.log(`ok    ${f.name.padEnd(26)} (fuente de API, no se comprueba como RSS)`);
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
      kind: "rss",
    });
    console.log(`ok    ${f.name.padEnd(26)} ${items.length} entradas`);
  } catch (err) {
    console.log(`FALLA ${f.name.padEnd(26)} ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${ALL.length} fuentes cargadas.`);
if (!check) console.log("Ejecuta 'npm run db:seed -- --check' para verificar que todas responden.");
await closePool();
