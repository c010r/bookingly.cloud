/** Un modelo de la lista, con el esfuerzo de razonamiento que admite. */
export type ModeloLlm = { nombre: string; esfuerzo?: string };

/**
 * "openai/gpt-oss-120b:low" -> { nombre, esfuerzo }. Los nombres de modelo
 * llevan barras pero nunca dos puntos, asi que el separador no es ambiguo.
 */
function parsearModelo(entrada: string): ModeloLlm {
  const corte = entrada.indexOf(":");
  if (corte === -1) return { nombre: entrada };
  return {
    nombre: entrada.slice(0, corte).trim(),
    esfuerzo: entrada.slice(corte + 1).trim() || undefined,
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get pgSsl() {
    return process.env.PGSSL === "1";
  },
  /**
   * El redactor habla con cualquier API compatible con OpenAI. Por defecto,
   * Groq en su capa gratuita; DeepSeek de pago queda como proveedor de
   * respaldo (LLM_FALLBACK_*) para cuando Groq agota el cupo diario. Un .env
   * de una epoca anterior se respeta en bloque (clave, URL y modelo juntos)
   * para no romper una instalacion ya desplegada.
   */
  get llmKey() {
    const v =
      process.env.LLM_API_KEY || process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!v) return required("LLM_API_KEY");
    return v;
  },
  get llmBaseUrl() {
    if (this.usaConfigAntigua) return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    return process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  },
  /**
   * Lista de modelos del proveedor principal por orden de preferencia,
   * separados por comas. Cada uno tiene su propia bolsa diaria (Groq: 200.000
   * tokens/dia y 1000 peticiones/dia POR MODELO), asi que rotar entre varios
   * multiplica lo que cabe en un dia; el cliente pasa al siguiente cuando uno
   * se agota, y si no queda ninguno escribe en el proveedor de respaldo.
   *
   * Cada entrada admite un sufijo ":esfuerzo" con el razonamiento que se le
   * pide. Va por modelo porque no coinciden: los gpt-oss de Groq aceptan
   * low/medium/high, los qwen solo none/default y deepseek-v4-flash de DeepSeek
   * piensa por defecto con "high" (":low" recorta bastante el gasto). Sin
   * sufijo no se manda nada y cada proveedor usa su default.
   */
  get llmModels(): ModeloLlm[] {
    const crudo = this.usaConfigAntigua
      ? process.env.DEEPSEEK_MODEL || "deepseek-chat"
      : process.env.LLM_MODEL ||
        "openai/gpt-oss-120b:low,openai/gpt-oss-20b:low,qwen/qwen3.8-27b:none,qwen/qwen3.6-27b:none";
    const lista = crudo
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .map(parsearModelo)
      .filter((m) => m.nombre);
    return lista.length > 0 ? lista : [{ nombre: "openai/gpt-oss-120b", esfuerzo: "low" }];
  },
  /** El preferido. Solo para mostrarlo; quien escribe cada pieza lo dice chat(). */
  get llmModel() {
    return this.llmModels[0].nombre;
  },
  /**
   * Proveedor de respaldo (DeepSeek de pago por defecto). El principal suele
   * ser la capa gratuita de Groq: cuando TODOS sus modelos agotan el cupo
   * diario, en vez de abortar la tanda se escribe aqui. Solo se activa si hay
   * modelo y clave de respaldo configurados (LLM_FALLBACK_*).
   */
  get llmFallbackModel(): ModeloLlm | null {
    const crudo = process.env.LLM_FALLBACK_MODEL;
    if (!crudo) return null;
    return parsearModelo(crudo);
  },
  get llmFallbackBaseUrl() {
    return process.env.LLM_FALLBACK_BASE_URL || "https://api.deepseek.com";
  },
  get llmFallbackKey() {
    const v = process.env.LLM_FALLBACK_API_KEY || process.env.DEEPSEEK_API_KEY;
    // Un marcador "PENDIENTE_PON_TU_CLAVE" del bootstrap no es una clave real.
    return v && !v.startsWith("PENDIENTE") ? v : "";
  },
  /** Hay con que escribir en el proveedor de respaldo. */
  get tieneFallback() {
    return Boolean(this.llmFallbackModel && this.llmFallbackKey);
  },
  /**
   * Tokens por minuto que admite el proveedor principal. Es el limite que
   * aprieta en las capas gratuitas: Groq da 8000. El cliente se autorregula
   * para no pasarse, porque un 429 gasta peticion igual que una llamada buena.
   * El proveedor de respaldo (DeepSeek de pago) no lo necesita: 0 lo desactiva.
   */
  get llmTokensPorMinuto() {
    const v = process.env.LLM_TOKENS_PER_MINUTE;
    return v === undefined || v === "" ? 8000 : Number(v);
  },
  /**
   * Cuanto texto del articulo original ve el redactor. Mas no siempre es
   * mejor: el cuerpo son 350-600 palabras y lo esencial de una noticia esta
   * en los primeros parrafos. Recortar abarata cada llamada y evita que una
   * pieza larga dispare el razonamiento.
   */
  get llmMaxSourceChars() {
    const v = process.env.LLM_MAX_SOURCE_CHARS;
    return v === undefined || v === "" ? 6000 : Number(v);
  },
  /** Solo hay claves DEEPSEEK_*: es un .env anterior al cambio de proveedor. */
  get usaConfigAntigua() {
    return Boolean(
      !process.env.LLM_API_KEY && !process.env.GROQ_API_KEY && process.env.DEEPSEEK_API_KEY
    );
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get maxPerRun() {
    return Number(process.env.INGEST_MAX_PER_RUN || 20);
  },
  /** Opcional: sube el limite de la API de GitHub de 60 a 5000 peticiones/hora. */
  get githubToken() {
    return process.env.GITHUB_TOKEN || "";
  },
  /** Developer token de Product Hunt, si se prefiere al par clave/secreto. */
  get productHuntToken() {
    return process.env.PRODUCTHUNT_TOKEN || "";
  },
  /** API Key de la aplicacion registrada en Product Hunt. */
  get productHuntClientId() {
    return process.env.PRODUCTHUNT_CLIENT_ID || "";
  },
  /** API Secret de esa misma aplicacion. */
  get productHuntClientSecret() {
    return process.env.PRODUCTHUNT_CLIENT_SECRET || "";
  },
  /** Hay forma de autenticarse contra Product Hunt? */
  get tieneProductHunt() {
    return Boolean(
      process.env.PRODUCTHUNT_TOKEN ||
        (process.env.PRODUCTHUNT_CLIENT_ID && process.env.PRODUCTHUNT_CLIENT_SECRET)
    );
  },
  /** Antiguedad maxima de una noticia para entrar. Mas vieja, se ignora. */
  get maxAgeHours() {
    return Number(process.env.INGEST_MAX_AGE_HOURS || 24);
  },
  /** Tope por fuente y tanda. Sin el, un solo medio copa la portada. */
  get maxPerSource() {
    const v = process.env.INGEST_MAX_PER_SOURCE;
    return v ? Number(v) : undefined;
  },
  /** El sistema publica solo; los borradores quedan para revision humana. */
  get autoPublish() {
    return (process.env.AUTO_PUBLISH ?? "1") !== "0";
  },
  /** Nota minima (0-100) para publicar sin revision. 0 = publicar todo. */
  get autoPublishMinScore() {
    const v = process.env.AUTO_PUBLISH_MIN_SCORE;
    return v === undefined || v === "" ? 0 : Number(v);
  },
  siteName: process.env.SITE_NAME || "Bookingly",
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  siteDescription:
    process.env.SITE_DESCRIPTION || "Noticias de tecnologia, reescritas con criterio.",
};
