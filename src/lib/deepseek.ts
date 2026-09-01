import { env } from "./env";

type Message = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  messages: Message[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export class DeepSeekError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

/**
 * DeepSeek expone una API compatible con la de OpenAI, asi que hablamos con
 * /chat/completions directamente y nos ahorramos un SDK.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const body = {
    model: env.deepseekModel,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 4000,
    stream: false,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetchWithRetry(`${env.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.deepseekKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new DeepSeekError("DeepSeek devolvio una respuesta vacia");
  return content;
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const text = await res.text().catch(() => "");
      // 429 y 5xx son reintentables; el resto es un error nuestro.
      if (res.status !== 429 && res.status < 500) {
        throw new DeepSeekError(`DeepSeek ${res.status}: ${text.slice(0, 300)}`, res.status);
      }
      lastError = new DeepSeekError(`DeepSeek ${res.status}: ${text.slice(0, 300)}`, res.status);
    } catch (err) {
      if (err instanceof DeepSeekError && err.status && err.status < 500 && err.status !== 429) {
        throw err;
      }
      lastError = err;
    }
    await sleep(1000 * 2 ** i);
  }
  throw lastError instanceof Error ? lastError : new DeepSeekError("Fallo al llamar a DeepSeek");
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
    throw new DeepSeekError("No se pudo parsear el JSON devuelto por DeepSeek");
  }
}
