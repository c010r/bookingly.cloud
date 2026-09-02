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
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("El modelo devolvio una respuesta vacia");
  return content;
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
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const text = await res.text().catch(() => "");
      const err = new LlmError(`LLM ${res.status}: ${text.slice(0, 300)}`, res.status);
      if (!esReintentable(res.status)) throw err;
      lastError = err;
    } catch (err) {
      if (err instanceof LlmError && err.status && !esReintentable(err.status)) {
        throw err;
      }
      lastError = err;
    }
    await sleep(1000 * 2 ** i);
  }
  throw lastError instanceof Error ? lastError : new LlmError("Fallo al llamar al modelo");
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
