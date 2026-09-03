/**
 * Secciones fijas del medio. Las etiquetas (tags) son libres; la categoria no:
 * cada noticia cae en una sola y define la navegacion del sitio.
 */
export const CATEGORIES = [
  { slug: "ia", name: "Inteligencia artificial", hint: "modelos, LLM, IA generativa, chips de IA, investigacion" },
  { slug: "infraestructura", name: "Infraestructura", hint: "cloud, contenedores, kubernetes, bases de datos, servidores, devops, observabilidad" },
  { slug: "software", name: "Software", hint: "sistemas operativos, lenguajes, frameworks, open source, herramientas de desarrollo" },
  { slug: "hardware", name: "Hardware", hint: "chips y CPU/GPU, servidores, almacenamiento, componentes y equipo de trabajo; no gadgets de consumo" },
  { slug: "ciberseguridad", name: "Ciberseguridad", hint: "brechas, malware, vulnerabilidades, privacidad, cifrado" },
  { slug: "internet", name: "Redes y nube", hint: "conectividad, CDN, proveedores cloud, plataformas, navegadores" },
  { slug: "negocios", name: "Empresas y startups", hint: "companias de TI, financiacion, adquisiciones, resultados, empleo tech" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const DEFAULT_CATEGORY: CategorySlug = "software";

/**
 * Lo que el modelo devuelve cuando la noticia no es de este medio. El foco es
 * estrecho a proposito —IA, software, apps, empresas de TI y lanzamientos— y
 * los feeds generalistas traen mucho videojuego, ciencia y cultura que antes
 * se publicaba por no tener donde rechazarlo.
 */
export const FUERA_DE_FOCO = "descartar";

export function esFueraDeFoco(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === FUERA_DE_FOCO;
}

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
