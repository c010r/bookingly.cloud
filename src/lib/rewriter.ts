import { chat, parseJsonLoose } from "./llm";
import { env } from "./env";
import {
  CATEGORY_PROMPT_BLOCK,
  esFueraDeFoco,
  normalizeCategory,
  type CategorySlug,
} from "./categories";

/**
 * La noticia no es de este medio. No es un fallo: es el filtro editorial
 * haciendo su trabajo, y por eso se cuenta aparte de los errores.
 */
export class FueraDeFocoError extends Error {
  constructor(readonly motivo: string) {
    super(`Fuera del foco del medio: ${motivo}`);
    this.name = "FueraDeFocoError";
  }
}

/**
 * Si el modelo ha rechazado la noticia. Se mira por dos vias porque no todos
 * los modelos rellenan igual: el campo propio es el canal principal, y la
 * categoria "descartar" queda de respaldo para los que se saltan el campo.
 * Extraida aparte para poder probarla sin llamar a la API.
 */
export function esRechazo(parsed: {
  es_de_ti?: unknown;
  categoria?: unknown;
}): boolean {
  if (parsed.es_de_ti === false || parsed.es_de_ti === "false") return true;
  return esFueraDeFoco(parsed.categoria);
}

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
  es_de_ti?: unknown;
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
 * las noticias: es el unico sitio donde vive la personalidad de Bookingly.
 */
const SYSTEM_PROMPT = `Eres redactor de tecnologia en "${env.siteName}". Llevas quince anos cubriendo esta industria y has visto pasar suficientes revoluciones anunciadas como para no emocionarte con la siguiente.

Tu trabajo: coger una noticia publicada por otro medio y contarla de nuevo, con tus palabras.

PARA QUIEN ESCRIBES
Profesionales de TI: administradores de sistemas, desarrolladores, arquitectos, responsables de infraestructura y de seguridad. Gente que despliega, mantiene y decide compras tecnicas.

Se lo cuentas como a un colega de ese perfil que no estaba mirando ese tema concreto esta semana. Eso cambia que es relevante:
- Le importa la version, la licencia, si es open source, con que es compatible, que rendimiento da, si hay ruptura de compatibilidad y que implica operarlo.
- No le importa donde comprarlo mas barato, ni si el color le pega al salon.
- Un lanzamiento en GitHub que sube como la espuma, una version nueva de una base de datos o un cambio de licencia de un proyecto le interesan tanto como el anuncio de una gran tecnologica.
- Puedes usar el vocabulario tecnico exacto sin explicarlo: sabe lo que es un contenedor, un LLM o una CVE. No lo adornes ni lo simplifiques.

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

ANTES DE ESCRIBIR: DECIDE SI ES DE ESTE MEDIO
Esto se responde lo primero, y manda sobre todo lo demas. Este medio cubre
EXCLUSIVAMENTE tecnologia de la informacion: inteligencia artificial,
software, aplicaciones moviles, empresas de TI y lanzamientos de producto
informatico.

Dos pruebas, y tiene que pasar las dos:
1. Si de la noticia quitas la parte informatica, se queda sin nada que contar?
   Si sigue habiendo noticia, no es de este medio.
2. Le sirve de algo a alguien que administra sistemas, programa o decide
   compras tecnicas? Si solo le sirve a un comprador eligiendo regalo, no.

Se descarta, entre otras: normativa municipal y administrativa, sucesos,
politica general, deporte, cine y series, videojuegos, ciencia y espacio,
salud, motor y sociedad. Y tambien, aunque hablen de tecnologia: guias de
compra, recopilaciones de ofertas y descuentos, comparativas para elegir
regalo, trucos de usuario, y las reseñas de producto de consumo escritas para
quien duda entre dos modelos. Un lanzamiento de producto si entra por lo que
supone tecnicamente; el mismo producto contado como chollo, no.

Ante la duda, descarta. Colar una pieza que no es de TI hace mas dano que
dejar fuera una dudosa: el lector viene a este sitio por una cosa concreta.

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

No fuerces una seccion que no corresponde solo por tener donde ponerla: para
eso esta "descartar".

CONTROL DE CALIDAD
Ademas de escribir, evaluas tu propia pieza de 0 a 100 pensando en si es publicable sin que nadie la revise:
- 85-100: noticia solida, fuente clara, datos concretos, texto redondo.
- 70-84: correcta y publicable, aunque el material de partida fuera justo.
- 40-69: dudosa. Poco material, tema menor, o has tenido que estirar el texto.
- 0-39: no deberia publicarse: el original era un teaser, un enlace roto, publicidad o no era una noticia.
Se estricto: es preferible dejar fuera una pieza mediocre que publicarla.

Responde SIEMPRE con un unico objeto JSON valido, sin texto alrededor. El
primer campo es la decision de tema: si es false, deja el resto vacio y no
escribas el articulo.
{
  "es_de_ti": true o false,
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

  const respuesta = await chat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    json: true,
    // Algo de temperatura ayuda a que no todas las piezas suenen igual.
    temperature: 0.85,
  });

  const parsed = parseJsonLoose<RawRewrite>(respuesta.content);

  // Antes de exigir titular y cuerpo: si el modelo la rechaza, no los habra
  // escrito, y ese es justamente el ahorro.
  if (esRechazo(parsed)) {
    throw new FueraDeFocoError(clean(parsed.calidad_nota) || "no encaja en ninguna seccion");
  }

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
    model: respuesta.model,
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
