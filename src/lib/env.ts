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
   * Groq: capa gratuita amplia y sin tarjeta. Si en el .env solo quedan las
   * variables DEEPSEEK_* de la version anterior, se respetan en bloque para no
   * romper una instalacion ya desplegada.
   */
  get llmKey() {
    const v =
      process.env.LLM_API_KEY || process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!v) return required("LLM_API_KEY");
    return v;
  },
  get llmBaseUrl() {
    if (this.usaConfigAntigua) return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    return process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
  },
  get llmModel() {
    if (this.usaConfigAntigua) return process.env.DEEPSEEK_MODEL || "deepseek-chat";
    return process.env.LLM_MODEL || "gemini-3.6-flash";
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
    return Number(process.env.INGEST_MAX_PER_RUN || 6);
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
  siteName: process.env.SITE_NAME || "c010r News",
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  siteDescription:
    process.env.SITE_DESCRIPTION || "Noticias de tecnologia, reescritas con criterio.",
};
