import { env, type ModeloLlm } from "./env";
import { query } from "./db";

type Message = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  messages: Message[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

/** Ademas del texto, quien lo escribio: con varios modelos ya no se da por hecho. */
export type ChatResult = { content: string; model: string };

/**
 * Todos los modelos estan en pausa. Se distingue del resto de errores porque
 * no tiene sentido seguir la tanda: lo que falla no es esta pieza, es que no
 * hay con que escribir ninguna.
 */
export class SinModelosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SinModelosError";
  }
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Cuerpo completo del error. El mensaje va recortado; aqui esta entero. */
    readonly body?: string
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Hablamos el protocolo de OpenAI (/chat/completions) directamente, sin SDK.
 * Eso vale para Groq, DeepSeek, Gemini, OpenRouter, Cerebras o cualquier otro
 * proveedor compatible: se cambia de uno a otro tocando solo el .env.
 *
 * LLM_MODEL admite una lista separada por comas. Se usa el primero disponible
 * y, cuando agota su cupo diario, se pasa al siguiente. Cada modelo tiene su
 * propia bolsa, asi que rotar multiplica lo que cabe en un dia.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const enPausa = await modelosEnPausa();
  const candidatos = env.llmModels.filter((m) => !enPausa.has(m.nombre));

  if (candidatos.length === 0) {
    throw new SinModelosError(
      `Sin modelos disponibles: ${env.llmModels.map((m) => m.nombre).join(", ")} agotaron su cupo diario`
    );
  }

  let ultimoError: unknown;
  for (const modelo of candidatos) {
    try {
      return { content: await llamar(modelo, opts), model: modelo.nombre };
    } catch (err) {
      if (!(err instanceof LlmError) || !motivoDePausa(err)) throw err;
      await pausar(modelo.nombre, err);
      ultimoError = err;
    }
  }
  throw ultimoError;
}

async function llamar(modelo: ModeloLlm, opts: ChatOptions): Promise<string> {
  const body = {
    model: modelo.nombre,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4000,
    stream: false,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    // Sin bajarlo, un modelo que razona se gasta el cupo de salida pensando y
    // devuelve el contenido vacio: el proveedor responde json_validate_failed
    // con failed_generation en blanco. Ademas dispara el gasto de tokens.
    ...(modelo.esfuerzo ? { reasoning_effort: modelo.esfuerzo } : {}),
  };

  const estimado = estimarCoste(
    opts.messages.reduce((n, m) => n + m.content.length, 0),
    body.max_tokens
  );
  await esperarCupo(modelo.nombre, estimado);

  const res = await fetchWithRetry(`${env.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.llmKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  // Apuntamos lo que ha costado de verdad; es lo que regula el ritmo.
  anotarConsumo(modelo.nombre, data.usage?.total_tokens ?? estimado);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("El modelo devolvio una respuesta vacia");
  return content;
}

// --- Rotacion entre modelos -------------------------------------------------

/**
 * Un modelo se aparta cuando agota su bolsa del dia (429 con "tokens per day")
 * o cuando el proveedor lo ha retirado (404). Ninguna de las dos se arregla
 * reintentando, y sin memoria entre ejecuciones cada tanda volveria a chocar
 * contra el mismo muro: la ingesta corre en un proceso nuevo cada 5 minutos.
 */
type MotivoPausa = { motivo: string; minutos: number };

function motivoDePausa(err: LlmError): MotivoPausa | null {
  const texto = `${err.message} ${err.body ?? ""}`;
  if (err.status === 429 && /per day|tokens_per_day|TPD|RequestsPerDay/i.test(texto)) {
    return { motivo: "cupo diario agotado", minutos: minutosSugeridos(texto) ?? 60 };
  }
  if (err.status === 404 && /model|does not exist|decommissioned/i.test(texto)) {
    return { motivo: "el proveedor ya no sirve este modelo", minutos: 24 * 60 };
  }
  return null;
}

/** Lee "Please try again in 18m38.448s" y devuelve los minutos, redondeando arriba. */
function minutosSugeridos(texto: string): number | null {
  const m = texto.match(/try again in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
  return Number.isFinite(total) && total > 0 ? Math.ceil(total) : null;
}

/**
 * Se cachea un minuto. En la ingesta el proceso dura poco y da igual, pero el
 * servidor de Next vive indefinidamente: sin caducidad, un modelo apartado no
 * volveria nunca aunque su cupo se hubiera renovado hace horas.
 */
let pausasCargadas: Set<string> | null = null;
let pausasLeidasEn = 0;

async function modelosEnPausa(): Promise<Set<string>> {
  if (pausasCargadas && Date.now() - pausasLeidasEn < 60_000) return pausasCargadas;
  const pausas = new Set<string>();
  try {
    const filas = await query<{ model: string }>(
      `SELECT model FROM llm_cooldowns WHERE until > now()`
    );
    for (const f of filas) pausas.add(f.model);
  } catch {
    // Sin base de datos se sigue funcionando: solo se pierde la memoria entre
    // tandas, y el proveedor volvera a decir que no con un 429.
  }
  pausasCargadas = pausas;
  pausasLeidasEn = Date.now();
  return pausas;
}

async function pausar(modelo: string, err: LlmError): Promise<void> {
  const pausa = motivoDePausa(err);
  if (!pausa) return;
  (await modelosEnPausa()).add(modelo);
  try {
    await query(
      `INSERT INTO llm_cooldowns (model, reason, until)
            VALUES ($1, $2, now() + make_interval(mins => $3))
       ON CONFLICT (model) DO UPDATE
              SET reason = EXCLUDED.reason, until = EXCLUDED.until, updated_at = now()`,
      [modelo, pausa.motivo, pausa.minutos]
    );
  } catch {
    // Igual que arriba: la pausa vale al menos para esta tanda.
  }
}

// --- Regulador de tokens por minuto ----------------------------------------

/**
 * Las capas gratuitas no limitan tanto el numero de llamadas como los tokens
 * que caben en cada minuto: Groq da 8000 por modelo. Pasarse no devuelve un
 * aviso sino un 429 que gasta peticion igual, asi que en vez de chocar y
 * reintentar, esperamos antes de llamar.
 *
 * Una ventana movil de 60 s por modelo, con el consumo real de cada respuesta.
 */
const consumoPorModelo = new Map<string, { t: number; tokens: number }[]>();

function ventana(modelo: string): { t: number; tokens: number }[] {
  let v = consumoPorModelo.get(modelo);
  if (!v) {
    v = [];
    consumoPorModelo.set(modelo, v);
  }
  return v;
}

function anotarConsumo(modelo: string, tokens: number) {
  ventana(modelo).push({ t: Date.now(), tokens });
}

function tokensEnLaVentana(modelo: string): number {
  const v = ventana(modelo);
  const corte = Date.now() - 60_000;
  while (v.length > 0 && v[0].t < corte) v.shift();
  return v.reduce((suma, e) => suma + e.tokens, 0);
}

/** Prompt + una estimacion de la respuesta. No hace falta que sea exacta. */
function estimarCoste(caracteresPrompt: number, maxTokens: number): number {
  return Math.ceil(caracteresPrompt / 3.5) + Math.min(maxTokens, 1500);
}

async function esperarCupo(modelo: string, estimado: number): Promise<void> {
  const cupo = env.llmTokensPorMinuto;
  if (cupo <= 0) return;
  // Una sola llamada mas grande que el cupo no se arregla esperando: se manda
  // y que responda el proveedor. Recortar la fuente es lo que evita ese caso.
  if (estimado >= cupo) return;
  while (tokensEnLaVentana(modelo) + estimado > cupo) {
    const masAntigua = ventana(modelo)[0];
    if (!masAntigua) return;
    const espera = 60_000 - (Date.now() - masAntigua.t) + 250;
    await sleep(Math.min(Math.max(espera, 500), 60_000));
  }
}

// --- Reintentos -------------------------------------------------------------

/**
 * Reintentables: 429 (cupo por minuto), 5xx y tambien 403. Ese ultimo parece
 * un error nuestro, pero Gemini lo devuelve de forma intermitente cuando su
 * capa gratuita esta saturada, mezclado con 503. Si la clave estuviera
 * revocada de verdad, los tres intentos fallarian igual y el 403 saldria
 * hacia arriba, que es lo que aborta la ingesta entera.
 */
function esReintentable(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  let esperaSugerida: number | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const text = await res.text().catch(() => "");
      const err = new LlmError(`LLM ${res.status}: ${text.slice(0, 300)}`, res.status, text);
      if (!esReintentable(res.status)) throw err;
      // Un cupo diario agotado no se arregla esperando unos segundos: que
      // salga ya, para probar el siguiente modelo.
      if (motivoDePausa(err)) throw err;
      lastError = err;
      // El proveedor sabe mejor que nosotros cuanto hay que esperar.
      esperaSugerida = leerRetryAfter(res, text);
    } catch (err) {
      if (err instanceof LlmError && err.status && !esReintentable(err.status)) throw err;
      if (err instanceof LlmError && motivoDePausa(err)) throw err;
      lastError = err;
    }
    await sleep(esperaSugerida ?? 1000 * 2 ** i);
    esperaSugerida = undefined;
  }
  throw lastError instanceof Error ? lastError : new LlmError("Fallo al llamar al modelo");
}

/**
 * Cuanto esperar antes de reintentar, segun el proveedor. Primero la cabecera
 * estandar retry-after; si no viene, algunos la meten en el texto del error
 * ("Please try again in 1.4625s"). Se topa a un minuto para no dejar la
 * ingesta colgada si un proveedor devuelve un valor absurdo.
 */
function leerRetryAfter(res: Response, texto: string): number | undefined {
  const cabecera = res.headers.get("retry-after");
  if (cabecera) {
    const segundos = Number(cabecera);
    if (Number.isFinite(segundos) && segundos > 0) return Math.min(segundos * 1000, 60_000);
  }
  const enTexto = texto.match(/try again in ([\d.]+)s/i);
  if (enTexto) {
    const segundos = Number(enTexto[1]);
    if (Number.isFinite(segundos) && segundos > 0) {
      return Math.min(Math.ceil(segundos * 1000) + 250, 60_000);
    }
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extrae el primer objeto JSON de una respuesta, tolerando vallas ```json. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new LlmError("No se pudo parsear el JSON devuelto por el modelo");
  }
}
