import { query } from "./db";

/**
 * Deteccion de noticias repetidas.
 *
 * Hay dos niveles:
 *  1. Misma URL -> mismo articulo. Se resuelve con el fingerprint (ver slug.ts).
 *  2. Misma noticia contada por medios distintos ("Apple compra X" en 5 webs).
 *     Eso no comparte URL ni titular exacto, asi que comparamos titulares
 *     normalizados con similitud de Jaccard sobre bigramas de palabras, mas un
 *     solape de entidades (nombres propios y cifras). Todo en la aplicacion:
 *     no exige extensiones de Postgres como pg_trgm.
 */

/** Palabras vacias que no aportan a la comparacion (es + en). */
const STOPWORDS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","al","y","o","en","con","por","para",
  "que","se","su","sus","es","son","ha","han","the","a","an","of","to","in","on","for","and","or",
  "with","its","it","is","are","has","have","new","this","that","as","at","by","from","will","says",
  "mas","muy","ya","pero","como","sin","sobre","tras","hasta","desde","tambien","segun","cuando",
]);

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave exacta: mismo titular, distinto medio o distinta URL. */
export function titleKey(title: string): string {
  return normalizeTitle(title)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .sort()
    .join(" ")
    .slice(0, 240);
}

function tokens(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function bigrams(list: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of list) out.add(t);
  for (let i = 0; i < list.length - 1; i++) out.add(`${list[i]} ${list[i + 1]}`);
  return out;
}

function interseccion(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const v of a) if (b.has(v)) n++;
  return n;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const n = interseccion(a, b);
  return n / (a.size + b.size - n);
}

/**
 * Contencion: que parte del conjunto pequeno esta en el grande. Jaccard
 * castiga que un titular sea mas detallado que otro, y eso es justo lo normal
 * entre medios: todos nombran el producto y cada uno anade datos distintos.
 *
 * Con menos de tres elementos se vuelve a Jaccard: compartir uno solo daria
 * 0.5 o 1.0 y bastaria un "PS5" suelto para hermanar noticias sin relacion.
 */
export function contencion(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const minimo = Math.min(a.size, b.size);
  if (minimo < 3) return jaccard(a, b);
  return interseccion(a, b) / minimo;
}

/**
 * Identificadores de producto: palabras que mezclan letra y digito (f9, s25,
 * ps5, 185hz). Sobreviven a la traduccion y a la reescritura mejor que nada.
 */
function modelos(rawTitle: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalizeTitle(rawTitle).split(" ")) {
    if (w.length >= 2 && /\p{L}/u.test(w) && /\d/.test(w)) out.add(w);
  }
  return out;
}

/** Entidades: numeros, codigos de producto y palabras que iban en mayuscula. */
function entities(rawTitle: string): Set<string> {
  const out = new Set<string>();
  for (const m of rawTitle.matchAll(/\b\p{Lu}[\p{L}\d.]{2,}\b/gu)) out.add(m[0].toLowerCase());
  // Ese patron pide tres caracteres y se dejaba fuera justo los codigos cortos:
  // "F9", "S25", "M4". Son de las senas de identidad mas fiables de un titular
  // —sobreviven a la traduccion y a la reescritura—, asi que cuentan tambien
  // como entidades, no solo en el termino de modelo.
  for (const m of modelos(rawTitle)) out.add(m);
  for (const m of rawTitle.matchAll(/\b\d[\d.,]*\s?(?:%|millones|billones|million|billion|bn|m|b)?\b/gi)) {
    const v = m[0].trim().toLowerCase();
    if (v.length > 1) out.add(v);
    // La cifra desnuda ("200") sobrevive a la traduccion; "200 millones" no.
    const bare = v.replace(/[^\d]/g, "");
    if (bare.length > 1) out.add(bare);
  }
  return out;
}

/**
 * Las palabras cambian al reescribir, y mas al traducir del ingles, pero los
 * nombres propios, las cifras y los codigos de producto sobreviven. De ahi que
 * el lexico pese menos que las entidades.
 */
export function similarity(titleA: string, titleB: string): number {
  const gramScore = jaccard(bigrams(tokens(titleA)), bigrams(tokens(titleB)));

  const entA = entities(titleA);
  const entB = entities(titleB);
  const entScore = contencion(entA, entB);

  // El codigo de producto solo cuenta si viene respaldado por otras entidades
  // comunes. "PS5" a secas aparece en noticias que no tienen nada que ver;
  // "Poco" + "F9" + "Ultra" juntos son el mismo lanzamiento.
  const modelScore =
    interseccion(entA, entB) >= 2 ? contencion(modelos(titleA), modelos(titleB)) : 0;

  // Ojo: la escala no llega a 1 sin codigo de producto, y es a proposito. Se
  // probo repartir ese peso entre los otros dos terminos y empeoro: subia a
  // todas las parejas que comparten protagonista pero cuentan cosas distintas
  // ("CD Projekt regala Witcher 3" y "CD Projekt no garantiza disco de Witcher
  // 4") por encima de duplicados reales. Que falte el codigo de producto es
  // informacion: sin el hay que exigir mas al lexico y a las entidades.
  return gramScore * 0.3 + entScore * 0.4 + modelScore * 0.3;
}

/**
 * Umbral por defecto. Calibrado midiendo sobre 366 titulares reales de un dia:
 * por debajo se cuelan noticias distintas del mismo protagonista y por encima
 * se escapan lanzamientos contados con palabras muy distintas.
 */
export const UMBRAL_DUPLICADO = 0.44;

export type DuplicateMatch = {
  id: number;
  title: string;
  source_name: string;
  slug: string;
  score: number;
};

export type DedupeOptions = {
  /** Ventana de busqueda en horas. Una misma noticia se replica en 1-3 dias. */
  windowHours?: number;
  /** Umbral de similitud a partir del cual se considera la misma noticia. */
  threshold?: number;
};

/**
 * Busca un articulo ya existente que cuente la misma noticia.
 * Devuelve null si es informacion nueva.
 */
export async function findDuplicate(
  candidateTitle: string,
  originalTitle: string,
  opts: DedupeOptions = {}
): Promise<DuplicateMatch | null> {
  const windowHours = opts.windowHours ?? 72;
  const threshold = opts.threshold ?? UMBRAL_DUPLICADO;

  const key = titleKey(originalTitle);
  if (key) {
    const exact = await query<{ id: number; title: string; source_name: string; slug: string }>(
      `SELECT id, title, source_name, slug
         FROM articles
        WHERE title_key = $1
          AND created_at > now() - ($2 || ' hours')::interval
        LIMIT 1`,
      [key, String(windowHours)]
    );
    if (exact[0]) return { ...exact[0], score: 1 };
  }

  const recent = await query<{
    id: number;
    title: string;
    source_title: string;
    source_name: string;
    slug: string;
  }>(
    `SELECT id, title, source_title, source_name, slug
       FROM articles
      WHERE created_at > now() - ($1 || ' hours')::interval
      ORDER BY created_at DESC
      LIMIT 1200`,
    [String(windowHours)]
  );

  let best: DuplicateMatch | null = null;
  for (const row of recent) {
    // Comparamos contra ambos titulares: el original ajeno y el nuestro ya reescrito.
    // Las cuatro combinaciones: el titular ajeno y el nuestro, contra los dos
    // suyos. Una noticia inglesa puede parecerse poco al original en espanol de
    // otro medio y mucho a la version ya reescrita.
    const score = Math.max(
      similarity(originalTitle, row.source_title),
      similarity(candidateTitle, row.title),
      similarity(originalTitle, row.title),
      similarity(candidateTitle, row.source_title)
    );
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: row.id, title: row.title, source_name: row.source_name, slug: row.slug, score };
    }
  }
  return best;
}

export type ExtraSource = { name: string; url: string; title: string; added_at: string };

/**
 * Cuando una noticia ya publicada aparece en otro medio, no creamos un duplicado:
 * anadimos ese medio a la lista de fuentes del articulo existente.
 */
export async function attachExtraSource(articleId: number, extra: Omit<ExtraSource, "added_at">) {
  const payload: ExtraSource = { ...extra, added_at: new Date().toISOString() };
  await query(
    `UPDATE articles
        SET extra_sources = extra_sources || $2::jsonb,
            updated_at = now()
      WHERE id = $1
        AND source_url <> $3
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(extra_sources) AS e
           WHERE e->>'url' = $3
        )`,
    [articleId, JSON.stringify([payload]), extra.url]
  );
}
