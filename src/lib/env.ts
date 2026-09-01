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
  get deepseekKey() {
    return required("DEEPSEEK_API_KEY");
  },
  get deepseekBaseUrl() {
    return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  },
  get deepseekModel() {
    return process.env.DEEPSEEK_MODEL || "deepseek-chat";
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
    return Number(process.env.INGEST_MAX_PER_RUN || 12);
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
