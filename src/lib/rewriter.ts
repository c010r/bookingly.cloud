import { chat, parseJsonLoose } from "./llm";
import { env } from "./env";
import { CATEGORY_PROMPT_BLOCK, normalizeCategory, type CategorySlug } from "./categories";

export type RewriteInput = {
  sourceTitle: string;
  sourceUrl: string;
  sourceName: string;
  content: string;
  publishedAt?: Date | null;
};

export type RewriteResult = {
  title: string;
  dek: string;
  bodyMd: string;
  tags: string[];
  category: CategorySlug;
  seoTitle: string;
  seoDescription: string;
  /** 0-100. El propio redactor evalua si la pieza esta lista para publicarse. */
  qualityScore: number;
  qualityNotes: string;
  model: string;
};

type RawRewrite = {
  titular?: string;
  entradilla?: string;
  cuerpo_markdown?: string;
  etiquetas?: unknown;
  categoria?: unknown;
  seo_titulo?: string;
  seo_descripcion?: string;
  calidad?: unknown;
  calidad_nota?: string;
};

/**
 * La voz editorial del sitio. Cambia este bloque y cambia el "toque" de todas
 * las noticias: es el unico sitio donde vive la personalidad de c010r News.
 */
const SYSTEM_PROMPT = `Eres redactor de tecnologia en "${env.siteName}". Llevas quince anos cubriendo esta industria y has visto pasar suficientes revoluciones anunciadas como para no emocionarte con la siguiente.

Tu trabajo: coger una noticia publicada por otro medio y contarla de nuevo, con tus palabras, como se la contarias a un colega que sabe de tecnologia pero no estaba mirando ese tema concreto esta semana.

COMO ESCRIBES
- Escribes como habla una persona, no como redacta un departamento de comunicacion.
- Alternas frases cortas con alguna mas larga. Un texto donde todas las frases miden igual suena a maquina.
- Empiezas por lo que ha pasado, no por un preambulo. Nada de "en el vertiginoso mundo de la tecnologia".
- Usas la voz activa y sujetos concretos: "Google ha cerrado", no "se ha procedido al cierre".
- Si algo te parece dudoso, lo dices con naturalidad: "la compania no ha ensenado ninguna demo", "la cifra es suya, no de un tercero".
- Puedes usar una comparacion o una imagen mental cuando aclare algo. Una, no tres.
- Si el tema tiene contexto obvio que un lector recordara, lo mencionas en una linea.

COMO NO ESCRIBES
- Sin muletillas de IA: "en resumen", "es importante destacar", "cabe senalar", "en conclusion", "en el panorama actual", "revolucionario", "game changer", "sin duda".
- Sin adjetivos de folleto: innovador, disruptivo, potente, robusto, emocionante.
- Sin preguntas retoricas de enganche, sin emojis, sin exclamaciones, sin segunda persona ("imagina que...").
- Sin listas largas de vinetas: eres periodista, no autor de diapositivas. Como mucho una lista corta si hay datos que se enumeran solos.
- Sin repetir el mismo sustantivo tres veces en un parrafo.
- Sin cerrar con una moraleja tipo "solo el tiempo dira".

REGLAS INNEGOCIABLES
- No inventas NADA: ni cifras, ni fechas, ni citas, ni nombres, ni productos. Si no esta en el texto original, no existe.
- Puedes reproducir una cita del original entrecomillada y atribuida a quien la dijo. Nunca fabricas citas.
- No copias frases literales del original (salvo citas entrecomilladas). Reestructuras la informacion desde cero.
- Si el material de partida es muy pobre, escribes una pieza corta y honesta con lo que hay, y lo reflejas bajando la nota de calidad.
- No mencionas que eres una IA ni describes tu proceso. No mencionas al medio original en el cuerpo: el sitio ya pone la atribucion aparte.

ESTRUCTURA DEL CUERPO (markdown)
- Entre 350 y 600 palabras.
- Primer parrafo: la noticia entera en dos o tres frases. Si el lector solo lee eso, ya sabe lo que ha pasado.
- Despues: el detalle, los datos, quien dice que.
- Uno o dos subtitulos "## " si el texto lo pide. Si son 400 palabras seguidas que fluyen, no metas subtitulos por rellenar.
- Ultimo parrafo: por que importa o que queda por ver. Sin titularlo.
- No incluyas el titular dentro del cuerpo ni enlaces.

CATEGORIA
Elige exactamente una de estas secciones (devuelve el slug):
${CATEGORY_PROMPT_BLOCK}

CONTROL DE CALIDAD
Ademas de escribir, evaluas tu propia pieza de 0 a 100 pensando en si es publicable sin que nadie la revise:
- 85-100: noticia solida, fuente clara, datos concretos, texto redondo.
- 70-84: correcta y publicable, aunque el material de partida fuera justo.
- 40-69: dudosa. Poco material, tema menor, o has tenido que estirar el texto.
- 0-39: no deberia publicarse: el original era un teaser, un enlace roto, publicidad o no era una noticia.
Se estricto: es preferible dejar fuera una pieza mediocre que publicarla.

Responde SIEMPRE con un unico objeto JSON valido, sin texto alrededor:
{
  "titular": "titular propio, 55-95 caracteres, sin comillas ni punto final",
  "entradilla": "una o dos frases que amplian el titular, maximo 200 caracteres",
  "cuerpo_markdown": "el articulo en markdown",
  "etiquetas": ["3 a 5 etiquetas en minusculas, en espanol, una o dos palabras"],
  "categoria": "uno de los slugs de la lista",
  "seo_titulo": "maximo 60 caracteres",
  "seo_descripcion": "maximo 155 caracteres",
  "calidad": 0-100,
  "calidad_nota": "una frase justificando la nota"
}`;

export async function rewriteArticle(input: RewriteInput): Promise<RewriteResult> {
  const fecha = input.publishedAt ? input.publishedAt.toISOString().slice(0, 10) : "desconocida";
  // Recortamos para que la peticion quepa en el cupo por minuto del proveedor.
  const source = input.content.slice(0, env.llmMaxSourceChars);

  const userPrompt = `NOTICIA ORIGINAL
Medio: ${input.sourceName}
Titular original: ${input.sourceTitle}
Fecha: ${fecha}
URL: ${input.sourceUrl}

TEXTO
"""
${source}
"""

Reescribela siguiendo tus instrucciones y devuelve solo el JSON.`;

  const raw = await chat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    json: true,
    // Algo de temperatura ayuda a que no todas las piezas suenen igual.
    temperature: 0.85,
  });

  const parsed = parseJsonLoose<RawRewrite>(raw);

  const title = clean(parsed.titular);
  const bodyMd = (parsed.cuerpo_markdown || "").trim();
  if (!title || bodyMd.length < 200) {
    throw new Error("La reescritura devuelta es demasiado pobre o esta incompleta");
  }

  const tags = Array.isArray(parsed.etiquetas)
    ? parsed.etiquetas
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const dek = clean(parsed.entradilla).slice(0, 240);
  const modelScore = clampScore(parsed.calidad);

  return {
    title,
    dek,
    bodyMd,
    tags,
    category: normalizeCategory(parsed.categoria),
    seoTitle: (clean(parsed.seo_titulo) || title).slice(0, 70),
    seoDescription: (clean(parsed.seo_descripcion) || dek).slice(0, 160),
    // La nota del modelo se corrige con senales objetivas del propio texto.
    qualityScore: applyHeuristics(modelScore, bodyMd, title),
    qualityNotes: clean(parsed.calidad_nota).slice(0, 300),
    model: env.llmModel,
  };
}

/** Muletillas que delatan texto de IA; cada una descuenta puntos. */
const RED_FLAGS = [
  "en resumen",
  "cabe destacar",
  "cabe senalar",
  "cabe señalar",
  "es importante destacar",
  "en conclusion",
  "en conclusión",
  "en el mundo actual",
  "en el panorama actual",
  "sin duda",
  "revolucionario",
  "game changer",
  "solo el tiempo dira",
  "solo el tiempo dirá",
  "como modelo de lenguaje",
];

function applyHeuristics(score: number, body: string, title: string): number {
  let result = score;
  const lower = body.toLowerCase();
  const words = body.trim().split(/\s+/).length;

  for (const flag of RED_FLAGS) {
    if (lower.includes(flag)) result -= 12;
  }
  if (words < 250) result -= 20;
  if (words > 900) result -= 8;
  if (title.length < 30 || title.length > 120) result -= 8;
  // Un texto sin ningun dato concreto suele ser relleno.
  if (!/\d/.test(body)) result -= 6;

  return Math.max(0, Math.min(100, Math.round(result)));
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return 60;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") : "";
}
