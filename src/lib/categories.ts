/**
 * Secciones fijas del medio. Las etiquetas (tags) son libres; la categoria no:
 * cada noticia cae en una sola y define la navegacion del sitio.
 */
export const CATEGORIES = [
  { slug: "ia", name: "Inteligencia artificial", hint: "modelos, LLM, IA generativa, chips de IA, investigacion" },
  { slug: "software", name: "Software", hint: "sistemas operativos, apps, lenguajes, desarrollo, open source" },
  { slug: "hardware", name: "Hardware", hint: "chips, moviles, ordenadores, componentes, dispositivos" },
  { slug: "ciberseguridad", name: "Ciberseguridad", hint: "brechas, malware, vulnerabilidades, privacidad, cifrado" },
  { slug: "internet", name: "Internet y redes", hint: "plataformas, redes sociales, navegadores, infraestructura, cloud" },
  { slug: "ciencia", name: "Ciencia y espacio", hint: "espacio, fisica, biotecnologia, energia, clima" },
  { slug: "negocios", name: "Negocios y startups", hint: "financiacion, adquisiciones, resultados, mercado, empleo tech" },
  { slug: "politica", name: "Politica digital", hint: "regulacion, leyes, antimonopolio, tribunales, gobiernos" },
  { slug: "gaming", name: "Videojuegos", hint: "juegos, consolas, motores, industria del videojuego" },
  { slug: "cultura", name: "Cultura digital", hint: "tendencias, sociedad, creadores, entretenimiento, streaming" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const DEFAULT_CATEGORY: CategorySlug = "software";

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function isCategory(slug: string): slug is CategorySlug {
  return BY_SLUG.has(slug as CategorySlug);
}

export function categoryName(slug: string): string {
  return BY_SLUG.get(slug as CategorySlug)?.name ?? slug;
}

export function normalizeCategory(value: unknown): CategorySlug {
  if (typeof value !== "string") return DEFAULT_CATEGORY;
  const clean = value.trim().toLowerCase();
  if (isCategory(clean)) return clean;
  // El modelo a veces devuelve el nombre en vez del slug.
  const byName = CATEGORIES.find((c) => c.name.toLowerCase() === clean);
  return byName?.slug ?? DEFAULT_CATEGORY;
}

/** Bloque para el prompt: el modelo debe elegir un slug de esta lista. */
export const CATEGORY_PROMPT_BLOCK = CATEGORIES.map(
  (c) => `- ${c.slug}: ${c.name} (${c.hint})`
).join("\n");
