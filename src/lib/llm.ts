import { env } from "./env";

type Message = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  messages: Message[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Hablamos el protocolo de OpenAI (/chat/completions) directamente, sin SDK.
 * Eso vale para Groq, DeepSeek, Gemini, OpenRouter, Cerebras o cualquier otro
 * proveedor compatible: se cambia de uno a otro tocando solo el .env.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const body = {
    model: env.llmModel,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4000,
    stream: false,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const estimado = estimarCoste(
    opts.messages.reduce((n, m) => n + m.content.length, 0),
    body.max_tokens
  );
  await esperarCupo(estimado);

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
  anotarConsumo(data.usage?.total_tokens ?? estimado);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("El modelo devolvio una respuesta vacia");
  return content;
}

/**
 * Regulador de tokens por minuto. Las capas gratuitas no limitan tanto el
 * numero de llamadas como los tokens que caben en cada minuto: Groq da 8000, y
 * pasarse no devuelve un aviso sino un 429 que gasta peticion igual. Asi que
 * en vez de chocar y reintentar, esperamos antes de llamar.
 *
 * Se lleva una ventana movil de 60 s con el consumo real de cada respuesta.
 */
const consumoReciente: { t: number; tokens: number }[] = [];

function anotarConsumo(tokens: number) {
  consumoReciente.push({ t: Date.now(), tokens });
}

function tokensEnLaVentana(): number {
  const corte = Date.now() - 60_000;
  while (consumoReciente.length > 0 && consumoReciente[0].t < corte) consumoReciente.shift();
  return consumoReciente.reduce((suma, e) => suma + e.tokens, 0);
}

/** Prompt + una estimacion de la respuesta. No hace falta que sea exacta. */
function estimarCoste(caracteresPrompt: number, maxTokens: number): number {
  return Math.ceil(caracteresPrompt / 3.5) + Math.min(maxTokens, 1500);
}

async function esperarCupo(estimado: number): Promise<void> {
  const cupo = env.llmTokensPorMinuto;
  if (cupo <= 0) return;
  // Una sola llamada mas grande que el cupo no se arregla esperando: se manda
  // y que responda el proveedor. Recortar la fuente es lo que evita ese caso.
  if (estimado >= cupo) return;
  while (tokensEnLaVentana() + estimado > cupo) {
    const masAntigua = consumoReciente[0];
    if (!masAntigua) return;
    const espera = 60_000 - (Date.now() - masAntigua.t) + 250;
    await sleep(Math.min(Math.max(espera, 500), 60_000));
  }
}

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
      const err = new LlmError(`LLM ${res.status}: ${text.slice(0, 300)}`, res.status);
      if (!esReintentable(res.status)) throw err;
      lastError = err;
      // El proveedor sabe mejor que nosotros cuanto hay que esperar.
      esperaSugerida = leerRetryAfter(res, text);
    } catch (err) {
      if (err instanceof LlmError && err.status && !esReintentable(err.status)) {
        throw err;
      }
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
