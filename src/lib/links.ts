/**
 * Enlaces de la noticia original que merece la pena conservar.
 *
 * Cuando el original dice "el codigo esta en GitHub", el lector quiere el
 * enlace, no la frase. Pero el texto que le llega al reescritor va ya sin
 * HTML, asi que los enlaces se pierden por el camino y el modelo no tiene de
 * donde sacarlos: si le pidieramos que los escriba, se los inventaria.
 *
 * De ahi este modulo. Los candidatos se extraen del HTML del original ANTES
 * de limpiarlo, y esa lista es lo unico que el modelo puede usar: todo enlace
 * que devuelva y no este aqui se descarta sin contemplaciones.
 */

export type Enlace = { url: string; texto: string };

/** Recursos que no son lectura: imagenes, hojas de estilo, descargas sueltas. */
const EXTENSION_ASSET =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|mp4|mp3|wav|zip|gz|dmg|exe)(\?|#|$)/i;

/**
 * Hosts que casi siempre son un boton de compartir, un perfil o un rastreador.
 * Se comparan exactos (sin "www.") para no llevarse por delante subdominios
 * legitimos: aws.amazon.com puede interesar, amazon.com no.
 */
const HOSTS_RUIDO = new Set([
  "twitter.com", "x.com", "facebook.com", "linkedin.com", "instagram.com",
  "pinterest.com", "t.me", "telegram.me", "wa.me", "whatsapp.com",
  "threads.net", "bsky.app", "mastodon.social", "tiktok.com", "flipboard.com",
  "reddit.com", "old.reddit.com", "getpocket.com", "digg.com", "tumblr.com",
  "amazon.com", "amazon.es", "amzn.to", "ebay.com",
  "patreon.com", "buymeacoffee.com", "ko-fi.com", "gravatar.com",
  // Botones de propina del autor. Aparecen en la firma de casi cualquier
  // blog tecnico y no tienen nada que ver con la noticia.
  "paypal.com", "paypal.me", "venmo.com", "cash.app", "liberapay.com",
  "opencollective.com", "gofundme.com", "donorbox.org",
  "doubleclick.net", "googletagmanager.com", "google-analytics.com",
  "feedburner.com", "feeds.feedburner.com", "polldaddy.com",
]);

/** Secciones de navegacion del propio medio: no son la noticia. */
const RUTAS_RUIDO =
  /^\/(tags?|topics?|categor(y|ia|ias|ies)|author|autor|autores|search|buscar|login|signin|sign-in|signup|register|subscribe|newsletter|privacy|privacidad|terms|terminos|cookies?|about|acerca|contact|contacto|feeds?|rss|amp|sitemap|advertise|publicidad|jobs|careers|shop|store)(\/|$)/i;

/** Patrocinio y papeleo del repositorio: ni es la noticia ni se lee. */
const RUTAS_SIN_VALOR = /\/(sponsors?|donate|donaciones)(\/|$)|\/(LICENSE|COPYING|NOTICE|CHANGELOG)(\.[a-z]+)?$/i;

/** Enlaces de "compartir en": llevan la URL de destino como parametro. */
const COMPARTIR = /\/(intent|sharer|share|submit)(\/|\.|$)/i;

/** Parametros de campana y rastreo: no identifican al recurso. */
const PARAMS_BASURA =
  /^(utm_|ga_|mc_|pk_|hsa_|_hs|ref$|refsrc|fbclid|gclid|igshid|source$|share$|at_|cmpid|ncid|__twitter)/i;

const A_TAG = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

/** Textos de ancla que no dicen nada: "aqui", "leer mas", la propia URL. */
const TEXTO_HUECO =
  /^(aqui|aquí|here|this|esto|ese|link|enlace|url|leer m(a|á)s|read more|learn more|more|m(a|á)s|click here|haz clic aqu(i|í)|ver m(a|á)s|source|fuente|v(i|í)a|via|original|website|web|sitio|p(a|á)gina|writeup|write-?up|post|blog|repo|repositorio|art(i|í)culo|paper|informe|anuncio|thread|hilo|wiki|demo|notas|changelog|\d+|https?:\/\/\S*)$/i;

function hostLimpio(u: URL): string {
  return u.hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * Cuanto vale un enlace para el lector de este medio. Un repositorio o una
 * ficha de CVE valen mucho mas que el blog corporativo de turno, y el orden
 * importa porque solo pasan al modelo los mejores.
 */
function puntuar(u: URL, texto: string): number {
  const host = hostLimpio(u);
  const ruta = u.pathname;
  let p = 20;

  if (/^(github|gitlab|codeberg|bitbucket)\.(com|org)$/.test(host)) p = 100;
  else if (/^(nvd\.nist\.gov|cve\.org|cve\.mitre\.org)$/.test(host)) p = 95;
  else if (/^(sourceforge\.net|sr\.ht|git\.sr\.ht)$/.test(host)) p = 90;
  else if (
    /^(npmjs\.com|pypi\.org|crates\.io|hub\.docker\.com|huggingface\.co|pkg\.go\.dev|rubygems\.org|packagist\.org|nuget\.org)$/.test(host)
  ) {
    p = 85;
  } else if (host === "arxiv.org") p = 75;
  // Enciclopedia, no fuente: solo si no hay nada mejor a lo que enlazar.
  else if (/(^|\.)wikipedia\.org$/.test(host)) p = 10;
  else if (/^docs?\./.test(host) || /^\/(docs?|documentation|api|reference|man)(\/|$)/i.test(ruta)) p = 65;
  else if (/(release|changelog|advisor|security|download|descarga)/i.test(ruta)) p = 60;

  // Lo que promete el propio enlace tambien cuenta.
  if (/github|repositorio|repository|c(o|ó)digo|source code|descargar|download/i.test(texto)) {
    p += 10;
  }

  return p;
}

/**
 * Forma canonica de una URL, solo para comparar y deduplicar: sin ancla, sin
 * parametros de campana y sin la barra final. No se guarda ni se muestra.
 */
export function normalizarUrl(bruta: string): string {
  try {
    const u = new URL(bruta);
    u.hash = "";
    u.hostname = hostLimpio(u);
    u.protocol = "https:";
    for (const clave of [...u.searchParams.keys()]) {
      if (PARAMS_BASURA.test(clave)) u.searchParams.delete(clave);
    }
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return bruta.trim().toLowerCase();
  }
}

/** Como escribe el medio su propia marca en los parametros de campana. */
function marca(base: URL | null): string {
  if (!base) return "";
  const t = hostLimpio(base).split(".")[0].replace(/[^a-z0-9]/g, "");
  // "dev" (dev.to) o "ars" saldrian en demasiados sitios por casualidad.
  return t.length >= 6 ? t : "";
}

/**
 * Publicidad de la pagina: un banner o un contenido patrocinado se delata en
 * su propia URL, porque la campana lleva el nombre del medio que lo sirve
 * ("utm_source=bleepingcomputer") o dice a las claras que es un patrocinio.
 * Sin esto, media ficha de enlaces acabaria siendo anuncios de seguridad.
 */
function esPublicidad(u: URL, base: URL | null): boolean {
  if (!u.search) return false;
  const query = decodeURIComponent(u.search).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/sponsor|patrocin|affiliate|afiliad/.test(query)) return true;
  const m = marca(base);
  return Boolean(m && query.includes(m));
}

/** Descarta lo que no es un enlace de lectura o no viene a cuento. */
function util(u: URL, base: URL | null): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (EXTENSION_ASSET.test(u.pathname)) return false;
  if (HOSTS_RUIDO.has(hostLimpio(u))) return false;
  if (RUTAS_RUIDO.test(u.pathname)) return false;
  if (RUTAS_SIN_VALOR.test(u.pathname)) return false;
  if (COMPARTIR.test(u.pathname) && u.search.length > 1) return false;
  if (esPublicidad(u, base)) return false;
  // El propio medio enlazandose a si mismo es navegacion o "noticias
  // relacionadas": la atribucion a la fuente ya va aparte en la ficha.
  if (base && hostLimpio(u) === hostLimpio(base)) return false;
  return true;
}

/** Etiqueta legible cuando el texto del ancla no sirve de nada. */
export function etiquetaPorDefecto(bruta: string): string {
  let u: URL;
  try {
    u = new URL(bruta);
  } catch {
    return "Enlace original";
  }
  const host = hostLimpio(u);
  const partes = u.pathname.split("/").filter(Boolean);

  if (host === "github.com") {
    if (partes.length < 2) return "Perfil en GitHub";
    const repo = `${partes[0]}/${partes[1]}`;
    if (partes[2] === "pull") return `Pull request en GitHub: ${repo}#${partes[3] ?? ""}`;
    if (partes[2] === "issues") return `Incidencia en GitHub: ${repo}#${partes[3] ?? ""}`;
    if (partes[2] === "releases") return `Notas de la version: ${repo}`;
    if (partes[2] === "blob" || partes[2] === "tree") return `Codigo en GitHub: ${repo}`;
    return `Repositorio en GitHub: ${repo}`;
  }
  if (host === "gitlab.com") return "Repositorio en GitLab";
  if (host === "codeberg.org") return "Repositorio en Codeberg";
  if (host === "npmjs.com") return "Paquete en npm";
  if (host === "pypi.org") return "Paquete en PyPI";
  if (host === "crates.io") return "Crate en crates.io";
  if (host === "nuget.org") return "Paquete en NuGet";
  if (host === "rubygems.org") return "Gema en RubyGems";
  if (host === "packagist.org") return "Paquete en Packagist";
  if (host === "pkg.go.dev") return "Modulo de Go";
  if (host === "hub.docker.com") return "Imagen en Docker Hub";
  if (host === "huggingface.co") return "Modelo en Hugging Face";
  if (host === "arxiv.org") return "Articulo en arXiv";
  if (/nvd\.nist\.gov|cve\.(org|mitre\.org)/.test(host)) return "Ficha del CVE";
  if (/^docs?\./.test(host) || /^\/(docs?|documentation)(\/|$)/i.test(u.pathname)) {
    return "Documentacion oficial";
  }
  return host;
}

function limpiarTexto(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto definitivo del enlace: el del ancla si dice algo, si no uno derivado. */
function etiquetar(url: string, ancla: string): string {
  const t = ancla.replace(/[\s.,;:]+$/, "").trim();
  if (!t || t.length < 3 || TEXTO_HUECO.test(t)) return etiquetaPorDefecto(url);
  // Muchos medios enlazan sobre un trozo de la frase ("explains Microsoft",
  // "provided here"). Como titulo de una lista de enlaces eso no se sostiene:
  // si empieza en minuscula y son varias palabras, es prosa, no una etiqueta.
  if (/^\p{Ll}/u.test(t) && /\s/.test(t)) return etiquetaPorDefecto(url);
  // Un ancla que solo repite el sitio ("GitHub", "npm") no dice que hay ahi;
  // la etiqueta derivada si: "Repositorio en GitHub: owner/repo".
  try {
    const plano = t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const host = hostLimpio(new URL(url)).replace(/[^a-z0-9]/g, "");
    if (plano && host.includes(plano)) return etiquetaPorDefecto(url);
  } catch {
    // Sin URL valida no hay nada que comparar.
  }
  return t.slice(0, 80);
}

/**
 * Candidatos sacados del HTML del original, ordenados por lo que le importan
 * al lector y con un tope por dominio para que un solo repositorio no se lleve
 * todas las plazas con enlaces a sus ficheros.
 */
export function extraerEnlaces(html: string, urlOrigen: string, max = 6): Enlace[] {
  if (!html) return [];

  let base: URL | null = null;
  try {
    base = new URL(urlOrigen);
  } catch {
    base = null;
  }

  const vistos = new Set<string>();
  const candidatos: { enlace: Enlace; puntos: number }[] = [];

  for (const m of html.matchAll(A_TAG)) {
    let u: URL;
    try {
      u = new URL(m[1].trim(), base?.toString());
    } catch {
      continue;
    }
    if (!util(u, base)) continue;

    const clave = normalizarUrl(u.toString());
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    // Un ancla sin texto es una imagen, y una imagen enlazada en el cuerpo de
    // una noticia casi siempre es un banner.
    const ancla = limpiarTexto(m[2]);
    if (!ancla) continue;

    // "My apps", "mi blog": el autor enlazando lo suyo. Se tolera si lo que
    // enlaza vale por si mismo (un repositorio, un paquete); si no, es firma.
    const puntos = puntuar(u, ancla);
    if (puntos <= 20 && /^(my|mi|mis|our|nuestro|nuestra)\s/i.test(ancla)) continue;

    candidatos.push({
      enlace: { url: u.toString(), texto: etiquetar(u.toString(), ancla) },
      puntos,
    });
  }

  const porHost = new Map<string, number>();
  const salida: Enlace[] = [];
  for (const c of candidatos.sort((a, b) => b.puntos - a.puntos)) {
    const host = new URL(c.enlace.url).hostname;
    const n = porHost.get(host) ?? 0;
    if (n >= 2) continue;
    porHost.set(host, n + 1);
    salida.push(c.enlace);
    if (salida.length >= max) break;
  }
  return salida;
}

/** Une varias listas sin repetir, respetando el orden de llegada. */
export function unirEnlaces(...listas: (Enlace[] | undefined)[]): Enlace[] {
  const vistos = new Set<string>();
  const salida: Enlace[] = [];
  for (const lista of listas) {
    for (const e of lista ?? []) {
      const clave = normalizarUrl(e.url);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push(e);
    }
  }
  return salida;
}

/**
 * Se queda con los enlaces que el modelo eligio Y estaban en la lista que se
 * le paso. Cualquier URL que no reconozcamos es una invencion suya y se cae.
 */
export function filtrarElegidos(candidatos: Enlace[], elegidos: unknown, max = 5): Enlace[] {
  if (!Array.isArray(elegidos)) return [];
  const porClave = new Map(candidatos.map((c) => [normalizarUrl(c.url), c]));
  const salida: Enlace[] = [];
  const vistos = new Set<string>();

  for (const bruto of elegidos) {
    const url = typeof bruto === "string" ? bruto : (bruto as { url?: unknown })?.url;
    if (typeof url !== "string") continue;

    const clave = normalizarUrl(url);
    const original = porClave.get(clave);
    if (!original || vistos.has(clave)) continue;
    vistos.add(clave);

    const propuesto =
      bruto && typeof bruto === "object"
        ? String((bruto as { texto?: unknown }).texto ?? "").trim()
        : "";
    salida.push({
      url: original.url,
      // El modelo suele etiquetar mejor que el ancla del original, pero si
      // devuelve una frase entera nos quedamos con la nuestra.
      texto: propuesto && propuesto.length <= 80 ? propuesto : original.texto,
    });
    if (salida.length >= max) break;
  }
  return salida;
}

const MD_LINK = /\[([^\]\n]*)\]\(\s*<?([^)\s]+)>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * Deshace los enlaces del cuerpo que apunten fuera de la lista permitida y
 * deja solo el texto. Un modelo que se inventa una URL plausible es peor que
 * uno que no enlaza: asi no llega ni al render.
 */
export function saneaEnlacesMd(md: string, permitidos: Enlace[]): string {
  const validos = new Set(permitidos.map((e) => normalizarUrl(e.url)));
  return md
    .replace(MD_LINK, (todo, texto: string, url: string) =>
      validos.has(normalizarUrl(url)) ? todo : texto
    )
    // Autoenlaces sueltos que marked convertiria en <a> por su cuenta.
    .replace(/<(https?:\/\/[^>\s]+)>/g, (todo, url: string) =>
      validos.has(normalizarUrl(url)) ? todo : url
    );
}

/** Lista para el prompt: el modelo solo puede elegir entre estas lineas. */
export function bloqueParaPrompt(enlaces: Enlace[]): string {
  return enlaces.map((e) => `- ${e.url}  (en el original: "${e.texto}")`).join("\n");
}
