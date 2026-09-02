/** Formatos de fecha compartidos entre servidor y cliente. */

export function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "hace 5 min", "hace 3 h", "ayer"... para listados de actualidad. */
export function formatRelative(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const min = Math.round((Date.now() - date.getTime()) / 60000);

  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;

  const horas = Math.round(min / 60);
  if (horas < 24) return `${horas} h`;

  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `${dias} d`;

  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/**
 * "1.234 vistas". Se muestra siempre, tambien con cero: es un dato del
 * articulo como la fecha o los minutos de lectura, y ocultarlo cuando esta a
 * cero lo hacia desaparecer de casi todas las notas.
 *
 * Ojo: quien abre una nota por primera vez vera "0 vistas", porque el contador
 * se incrementa desde el navegador despues de pintar la pagina.
 */
export function formatViews(n: number | null | undefined): string {
  const v = n && n > 0 ? n : 0;
  return `${v.toLocaleString("es-ES")} ${v === 1 ? "vista" : "vistas"}`;
}

/**
 * ISO 8601 para el atributo datetime de <time>. Acepta lo que devuelve la
 * base (Date) y tambien una cadena, por si el dato llega ya serializado.
 */
export function isoDate(d: Date | string | null): string | undefined {
  if (!d) return undefined;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
